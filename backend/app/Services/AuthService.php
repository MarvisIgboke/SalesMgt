<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\RefreshToken;
use App\Models\User;
use App\Models\UserSession;
use App\Support\Presenter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class AuthService
{
    public const REFRESH_TTL_DAYS = 30;

    /**
     * Create the AuthSession payload and persist token/session records.
     */
    public function issue(User $user, string $deviceName, ?string $ip, ?string $userAgent, bool $remember = false): array
    {
        $token = $user->createToken($deviceName ?: 'web');

        $session = UserSession::create([
            'user_id' => $user->id,
            'personal_access_token_id' => $token->accessToken->id,
            'device' => $deviceName ?: 'Web',
            'ip' => $ip,
            'user_agent' => $userAgent,
            'is_current' => true,
            'last_active_at' => now(),
        ]);

        $refresh = $this->issueRefreshToken($user, $remember);

        $user->forceFill(['last_login_at' => now()])->save();

        return $this->sessionPayload($user, $token->plainTextToken, $refresh, $deviceName, $session->id);
    }

    public function sessionPayload(
        User $user,
        string $accessToken,
        ?string $refreshToken = null,
        ?string $deviceName = null,
        ?int $sessionId = null,
    ): array {
        $user->loadMissing(['roles', 'permissions', 'business.subscription.plan', 'business.wallet']);

        $business = $user->business;
        $subscription = $business?->subscription;
        $wallet = $business?->wallet;

        return [
            'user' => Presenter::user($user),
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => null,
            'device_name' => $deviceName,
            'session_id' => $sessionId,
            'subscription' => $business
                ? Presenter::subscription($business, $subscription, $wallet)
                : ['status' => 'none', 'plan' => 'No Plan', 'expiry_date' => null, 'trial_ends_at' => null, 'limits' => []],
            'wallet' => Presenter::wallet($wallet, $business?->currency ?? 'NGN'),
        ];
    }

    public function issueRefreshToken(User $user, bool $remember = false): string
    {
        $plain = bin2hex(random_bytes(32));

        RefreshToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addDays($remember ? self::REFRESH_TTL_DAYS * 2 : self::REFRESH_TTL_DAYS),
        ]);

        return $plain;
    }

    /**
     * Exchange a refresh token for a fresh access token (rotating the refresh token).
     */
    public function refresh(string $plainToken): array
    {
        $record = RefreshToken::query()
            ->where('token_hash', hash('sha256', $plainToken))
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->first();

        if ($record === null) {
            throw new ApiException('INVALID_REFRESH_TOKEN', 'The refresh token is invalid or has expired.', 401);
        }

        $user = $record->user;

        if ($user === null || ! $user->is_active) {
            throw new ApiException('ACCOUNT_INACTIVE', 'This account is not active.', 403);
        }

        $record->forceFill(['revoked_at' => now()])->save();

        $token = $user->createToken('refresh');

        $refresh = $this->issueRefreshToken($user);

        return [
            'access_token' => $token->plainTextToken,
            'refresh_token' => $refresh,
            'token_type' => 'Bearer',
        ];
    }

    public function logout(User $user, ?int $accessTokenId = null): void
    {
        if ($accessTokenId !== null) {
            $user->tokens()->whereKey($accessTokenId)->delete();
            UserSession::query()
                ->where('user_id', $user->id)
                ->where('personal_access_token_id', $accessTokenId)
                ->delete();
        }
    }

    public function revokeAllRefreshTokens(User $user): void
    {
        RefreshToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => Carbon::now()]);
    }

    public function hashPassword(string $password): string
    {
        return Hash::make($password);
    }
}