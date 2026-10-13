<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('subscription_plans', 'product_limit')) {
            Schema::table('subscription_plans', function (Blueprint $table) {
                $table->dropColumn('product_limit');
            });
        }

        if (! Schema::hasColumn('subscription_plans', 'duration_months')) {
            Schema::table('subscription_plans', function (Blueprint $table) {
                $table->unsignedInteger('duration_months')->default(1)->after('branch_limit');
            });
        }

        // Plans no longer cap the number of products; strip the legacy limit
        // from any subscription that copied it from the old plan shape.
        if (Schema::hasTable('subscriptions')) {
            DB::table('subscriptions')
                ->whereNotNull('limits')
                ->orderBy('id')
                ->get(['id', 'limits'])
                ->each(function (object $row): void {
                    $limits = json_decode((string) $row->limits, true);

                    if (is_array($limits) && array_key_exists('product_limit', $limits)) {
                        unset($limits['product_limit']);

                        DB::table('subscriptions')->where('id', $row->id)->update([
                            'limits' => json_encode($limits),
                        ]);
                    }
                });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('subscription_plans', 'product_limit')) {
            Schema::table('subscription_plans', function (Blueprint $table) {
                $table->unsignedInteger('product_limit')->nullable()->after('branch_limit');
            });
        }

        if (Schema::hasColumn('subscription_plans', 'duration_months')) {
            Schema::table('subscription_plans', function (Blueprint $table) {
                $table->dropColumn('duration_months');
            });
        }
    }
};
