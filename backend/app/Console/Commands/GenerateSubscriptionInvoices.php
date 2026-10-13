<?php

namespace App\Console\Commands;

use App\Services\SubscriptionBillingService;
use Illuminate\Console\Command;

class GenerateSubscriptionInvoices extends Command
{
    protected $signature = 'billing:generate-invoices
        {--period= : The billing period as Y-m (defaults to the current month)}
        {--business= : Limit generation to a single business id}';

    protected $description = 'Generate monthly subscription invoices for every business';

    public function handle(SubscriptionBillingService $billing): int
    {
        $business = $this->option('business');

        $created = $billing->run(
            $this->option('period'),
            $business !== null && $business !== '' ? (int) $business : null,
        );

        $this->info(sprintf('Generated %d subscription invoice(s).', count($created)));

        return self::SUCCESS;
    }
}
