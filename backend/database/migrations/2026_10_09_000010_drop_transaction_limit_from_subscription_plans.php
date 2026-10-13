<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('subscription_plans', 'transaction_limit')) {
            Schema::table('subscription_plans', function (Blueprint $table) {
                $table->dropColumn('transaction_limit');
            });
        }

        // Plans apply to a business; limits are shared across every branch. The
        // transaction limit is no longer part of the plan, so strip it from any
        // subscription limits copied from the old plans.
        if (Schema::hasTable('subscriptions')) {
            DB::table('subscriptions')
                ->whereNotNull('limits')
                ->orderBy('id')
                ->get(['id', 'limits'])
                ->each(function (object $row): void {
                    $limits = json_decode((string) $row->limits, true);

                    if (is_array($limits) && array_key_exists('transaction_limit', $limits)) {
                        unset($limits['transaction_limit']);

                        DB::table('subscriptions')->where('id', $row->id)->update([
                            'limits' => json_encode($limits),
                        ]);
                    }
                });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('subscription_plans', 'transaction_limit')) {
            Schema::table('subscription_plans', function (Blueprint $table) {
                $table->unsignedBigInteger('transaction_limit')->nullable()->after('product_limit');
            });
        }
    }
};
