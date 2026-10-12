<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\Wallet;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if ($user === null || ! Hash::check($data['password'], $user->password)) {
            throw new ApiException(
                'INVALID_CREDENTIALS',
                'The provided credentials are incorrect.',
                422,
                ['email' => ['The provided credentials are incorrect.']],
            );
        }

        if (! $user->is_active) {
            throw new ApiException('ACCOUNT_INACTIVE', 'This account has been deactivated. Contact your administrator.', 403);
        }

        $session = $this->auth->issue(
            $user,
            $data['device_name'] ?? 'Web',
            $request->ip(),
            $request->userAgent(),
            (bool) ($data['remember'] ?? false),
        );

        return ApiResponse::success($session, 'Login successful.');
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return ApiResponse::success(
            $this->auth->sessionPayload($user, (string) $request->bearerToken()),
        );
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'avatar_url' => ['nullable', 'string', 'max:2048'],
            'current_password' => ['required_with:password', 'string'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        if (! empty($data['password'])) {
            if (! Hash::check((string) $data['current_password'], $user->password)) {
                throw new ApiException(
                    'INVALID_PASSWORD',
                    'Your current password is incorrect.',
                    422,
                    ['current_password' => ['Your current password is incorrect.']],
                );
            }

            $user->password = $data['password'];
        }

        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }

        if (array_key_exists('phone', $data)) {
            $user->phone = $data['phone'];
        }

        if (array_key_exists('avatar_url', $data)) {
            $user->avatar_url = $data['avatar_url'];
        }

        $user->save();

        return ApiResponse::success(
            $this->auth->sessionPayload($user->fresh(), (string) $request->bearerToken()),
            'Profile updated.',
        );
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $tokenId = $user->currentAccessToken()?->id;

        $this->auth->revokeAllRefreshTokens($user);
        $this->auth->logout($user, $tokenId);

        return ApiResponse::success(null, 'You have been logged out.');
    }

    public function refresh(Request $request)
    {
        $data = $request->validate([
            'refresh_token' => ['required', 'string'],
        ]);

        return ApiResponse::success($this->auth->refresh($data['refresh_token']), 'Token refreshed.');
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        Password::sendResetLink($data);

        return ApiResponse::success(
            ['sent' => true],
            'If an account exists for that email, a reset link has been sent.',
        );
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset($data, function (User $user, string $password) {
            $user->forceFill(['password' => $password])->save();
            $user->tokens()->delete();
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw new ApiException('PASSWORD_RESET_FAILED', __($status), 422);
        }

        return ApiResponse::success(null, 'Your password has been reset.');
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'business_name' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:191', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'phone' => ['nullable', 'string', 'max:30'],
            'plan_id' => ['nullable', 'integer'],
        ]);

        $slug = Str::slug($data['business_name']);

        return DB::transaction(function () use ($data, $slug) {
            $business = Business::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => $data['business_name'],
                    'slug' => $slug,
                    'currency' => 'NGN',
                    'timezone' => 'Africa/Lagos',
                ]
            );

            if (! Wallet::withoutGlobalScope('tenant-business')->where('business_id', $business->id)->exists()) {
                Wallet::create(['business_id' => $business->id, 'currency' => $business->currency, 'balance' => 0, 'pending' => 0]);
            }

            if (! Subscription::withoutGlobalScope('tenant-business')->where('business_id', $business->id)->exists()) {
                $plan = SubscriptionPlan::find($data['plan_id'] ?? null) ?? SubscriptionPlan::where('slug', 'starter')->first();
                if ($plan) {
                    Subscription::create([
                        'business_id' => $business->id,
                        'plan_id' => $plan->id,
                        'status' => 'trial',
                        'starts_at' => now()->toDateString(),
                        'trial_ends_at' => now()->addDays(30)->toDateString(),
                        'limits' => $plan->limits(),
                    ]);
                }
            }

            $user = User::create([
                'business_id' => $business->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'] ?? null,
                'password' => $data['password'],
                'is_active' => true,
                'branch_ids' => [],
            ]);

            if (method_exists($user, 'assignRole')) {
                $user->assignRole('Business Admin');
            }

            $session = $this->auth->issue(
                $user,
                'Web',
                request()->ip(),
                request()->userAgent(),
                false,
            );

            return ApiResponse::success($session, 'Business registered successfully.');
        });
    }
}