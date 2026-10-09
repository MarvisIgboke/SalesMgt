<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('businesses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('currency', 8)->default('NGN');
            $table->string('timezone', 64)->default('Africa/Lagos');
            $table->string('logo_url')->nullable();
            $table->string('address')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->timestamps();
        });

        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code')->nullable();
            $table->string('address')->nullable();
            $table->string('phone')->nullable();
            $table->string('type')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('defaults')->nullable();
            $table->timestamps();

            $table->index(['business_id', 'is_active']);
        });

        Schema::create('business_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('setting_key');
            $table->json('value')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'branch_id', 'setting_key']);
        });

        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->unsignedInteger('staff_limit')->nullable();
            $table->unsignedInteger('branch_limit')->nullable();
            $table->unsignedInteger('product_limit')->nullable();
            $table->unsignedBigInteger('transaction_limit')->nullable();
            $table->decimal('monthly_price', 14, 2)->nullable();
            $table->decimal('quarterly_price', 14, 2)->nullable();
            $table->decimal('annual_price', 14, 2)->nullable();
            $table->string('currency', 8)->default('NGN');
            $table->unsignedInteger('grace_days')->default(0);
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('subscription_plans')->restrictOnDelete();
            $table->string('status')->default('none');
            $table->date('starts_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->date('trial_ends_at')->nullable();
            $table->date('grace_ends_at')->nullable();
            $table->json('limits')->nullable();
            $table->timestamps();
        });

        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('currency', 8)->default('NGN');
            $table->decimal('balance', 16, 2)->default(0);
            $table->decimal('pending', 16, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->decimal('amount', 16, 2);
            $table->decimal('balance_before', 16, 2)->default(0);
            $table->decimal('balance_after', 16, 2)->default(0);
            $table->string('reference')->nullable();
            $table->string('method')->nullable();
            $table->string('status')->default('completed');
            $table->json('meta')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['business_id', 'created_at']);
        });

        Schema::create('user_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('personal_access_token_id')->nullable()->index();
            $table->string('device')->nullable();
            $table->string('ip')->nullable();
            $table->string('user_agent')->nullable();
            $table->boolean('is_current')->default(false);
            $table->timestamp('last_active_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_current']);
        });

        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
        });

        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->string('key');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('business_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->string('request_method');
            $table->json('request_data')->nullable();
            $table->unsignedSmallInteger('response_status');
            $table->longText('response_json');
            $table->timestamps();

            $table->unique(['key', 'user_id', 'path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('user_sessions');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('subscription_plans');
        Schema::dropIfExists('business_settings');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('businesses');
    }
};