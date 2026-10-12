<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shifts', function (Blueprint $table) {
            $table->string('reference')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('assigned_user_ids')->nullable();
            $table->decimal('opening_stock_qty', 16, 3)->default(0);
            $table->decimal('opening_stock_value', 16, 2)->default(0);
            $table->decimal('closing_stock_qty', 16, 3)->nullable();
            $table->decimal('closing_stock_value', 16, 2)->nullable();
            $table->decimal('stock_variance', 16, 2)->nullable();
        });

        Schema::create('sale_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shift_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reference');
            $table->string('status')->default('open');
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->decimal('opening_balance', 16, 2)->default(0);
            $table->decimal('closing_amount', 16, 2)->nullable();
            $table->decimal('expected_cash', 16, 2)->default(0);
            $table->decimal('variance', 16, 2)->nullable();
            $table->decimal('opening_stock_qty', 16, 3)->default(0);
            $table->decimal('opening_stock_value', 16, 2)->default(0);
            $table->decimal('closing_stock_qty', 16, 3)->nullable();
            $table->decimal('closing_stock_value', 16, 2)->nullable();
            $table->decimal('stock_variance', 16, 2)->nullable();
            $table->decimal('sales_total', 16, 2)->default(0);
            $table->unsignedInteger('sales_count')->default(0);
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'reference']);
            $table->index(['business_id', 'branch_id', 'status']);
            $table->index(['shift_id']);
            $table->index(['user_id']);
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->foreignId('sale_session_id')->nullable()->constrained('sale_sessions')->nullOnDelete();
            $table->index(['shift_id']);
            $table->index(['sale_session_id']);
        });

        Schema::table('shift_cash_movements', function (Blueprint $table) {
            $table->foreignId('sale_session_id')->nullable()->constrained('sale_sessions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('shift_cash_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sale_session_id');
        });

        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex(['shift_id']);
            $table->dropIndex(['sale_session_id']);
            $table->dropConstrainedForeignId('shift_id');
            $table->dropConstrainedForeignId('sale_session_id');
        });

        Schema::dropIfExists('sale_sessions');

        Schema::table('shifts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('closed_by');
            $table->dropColumn([
                'reference',
                'assigned_user_ids',
                'opening_stock_qty',
                'opening_stock_value',
                'closing_stock_qty',
                'closing_stock_value',
                'stock_variance',
            ]);
        });
    }
};
