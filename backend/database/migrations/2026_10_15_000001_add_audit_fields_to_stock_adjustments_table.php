<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_adjustments', function (Blueprint $table) {
            $table->decimal('balance_before', 16, 3)->nullable()->after('quantity');
            $table->decimal('balance_after', 16, 3)->nullable()->after('balance_before');
            $table->string('decision_notes')->nullable()->after('decided_at');
        });
    }

    public function down(): void
    {
        Schema::table('stock_adjustments', function (Blueprint $table) {
            $table->dropColumn(['balance_before', 'balance_after', 'decision_notes']);
        });
    }
};
