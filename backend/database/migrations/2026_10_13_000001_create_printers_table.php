<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('type')->default('receipt');
            $table->string('connection')->default('network');
            $table->string('address')->nullable();
            $table->string('paper_width')->default('80mm');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('auto_print_receipts')->default(true);
            $table->boolean('print_kitchen_tickets')->default(false);
            $table->boolean('print_labels')->default(false);
            $table->string('status')->default('unknown');
            $table->timestamp('last_seen_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['business_id', 'branch_id', 'name']);
            $table->index(['business_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printers');
    }
};
