<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code')->nullable();
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['business_id', 'name']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('business_id')->constrained('departments')->nullOnDelete();
            $table->index(['business_id', 'department_id']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('department_id')->nullable()->after('business_id')->constrained('departments')->nullOnDelete();
            $table->index(['business_id', 'department_id']);
        });

        // Every business gets a default "General" department; existing staff and
        // products are migrated onto it so nothing is left unassigned.
        foreach (DB::table('businesses')->pluck('id') as $businessId) {
            $departmentId = DB::table('departments')->insertGetId([
                'business_id' => $businessId,
                'name' => 'General',
                'code' => 'GEN',
                'description' => 'Default department for unclassified staff and products.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('users')->where('business_id', $businessId)->whereNull('department_id')->update(['department_id' => $departmentId]);
            DB::table('products')->where('business_id', $businessId)->whereNull('department_id')->update(['department_id' => $departmentId]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['business_id', 'department_id']);
            $table->dropConstrainedForeignId('department_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['business_id', 'department_id']);
            $table->dropConstrainedForeignId('department_id');
        });

        Schema::dropIfExists('departments');
    }
};