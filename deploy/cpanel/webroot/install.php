<?php

declare(strict_types=1);

/**
 * SalesMgt - one-time web installer (for cPanel accounts without SSH/Terminal).
 * -----------------------------------------------------------------------------
 * SECURITY:
 *   1. Set a strong secret below (or via the SALESMGT_INSTALL_KEY env var).
 *   2. Upload this file to public_html and open it with ?key=YOUR_SECRET.
 *   3. DELETE THIS FILE from the server immediately after the install finishes.
 */

use Illuminate\Support\Facades\Artisan;

$expectedKey = getenv('SALESMGT_INSTALL_KEY') ?: 'CHANGE_ME_BEFORE_UPLOADING';
$providedKey = (string) ($_POST['key'] ?? $_GET['key'] ?? '');

if (! hash_equals($expectedKey, $providedKey)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    exit("Forbidden. Open this file with the installer key, e.g. ?key=YOUR_SECRET\n");
}

$appBasePath = dirname(__DIR__) . '/salesmgt';
$results = [];

if (! is_file($appBasePath . '/vendor/autoload.php')) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit("Laravel dependencies not found at: {$appBasePath}/vendor\n" .
        "Upload the application (including the vendor/ directory) before running the installer.\n");
}

require $appBasePath . '/vendor/autoload.php';

/** @var \Illuminate\Foundation\Application $app */
$app = require_once $appBasePath . '/bootstrap/app.php';

$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

/**
 * Run an artisan command and capture its result.
 *
 * @return array{ok: bool, output: string}
 */
function sm_artisan(string $command, array $parameters = []): array
{
    try {
        $exit = Artisan::call($command, $parameters);

        return ['ok' => $exit === 0, 'output' => trim((string) Artisan::output())];
    } catch (\Throwable $e) {
        return ['ok' => false, 'output' => $e->getMessage()];
    }
}

$action = (string) ($_POST['action'] ?? $_GET['action'] ?? '');

if ($action === 'run') {
    // 1) Application key.
    if (blank(env('APP_KEY'))) {
        $results['key:generate'] = sm_artisan('key:generate', ['--force' => true]);
    } else {
        $results['key:generate'] = ['ok' => true, 'output' => 'APP_KEY already set - skipped.'];
    }

    // 2) Database schema.
    $results['migrate'] = sm_artisan('migrate', ['--force' => true]);

    // 3) Roles, permissions and subscription plans (never the demo data).
    $results['seed:roles/permissions'] = sm_artisan('db:seed', [
        '--class' => 'Database\\Seeders\\RoleAndPermissionSeeder',
        '--force' => true,
    ]);
    $results['seed:plans'] = sm_artisan('db:seed', [
        '--class' => 'Database\\Seeders\\PlanSeeder',
        '--force' => true,
    ]);

    // 4) Public storage symlink (public_html/storage -> app storage/public).
    $publicStorage = __DIR__ . '/storage';
    $target = $appBasePath . '/storage/app/public';
    if (is_link($publicStorage) || file_exists($publicStorage)) {
        $results['storage link'] = ['ok' => true, 'output' => 'public_html/storage already exists.'];
    } elseif (! is_dir($target)) {
        $results['storage link'] = ['ok' => false, 'output' => 'Target directory missing: ' . $target];
    } elseif (@symlink($target, $publicStorage)) {
        $results['storage link'] = ['ok' => true, 'output' => 'Created public_html/storage -> ' . $target];
    } else {
        $results['storage link'] = [
            'ok' => false,
            'output' => 'Could not create the symlink. Create it from cPanel Terminal with: '
                . 'ln -s ' . $target . ' ' . $publicStorage,
        ];
    }

    // 5) Optional Super Admin account.
    $adminEmail = trim((string) ($_POST['admin_email'] ?? ''));
    $adminPassword = (string) ($_POST['admin_password'] ?? '');
    $adminName = trim((string) ($_POST['admin_name'] ?? '')) ?: 'Super Admin';

    if ($adminEmail !== '' && $adminPassword !== '') {
        try {
            $user = \App\Models\User::query()->firstOrNew(['email' => $adminEmail]);
            $user->name = $adminName;
            $user->password = $adminPassword; // hashed automatically by the model cast.
            $user->is_active = true;
            $user->save();
            $user->assignRole('Super Admin');

            $results['super admin'] = ['ok' => true, 'output' => "Ready: {$adminEmail}"];
        } catch (\Throwable $e) {
            $results['super admin'] = ['ok' => false, 'output' => $e->getMessage()];
        }
    } else {
        $results['super admin'] = ['ok' => true, 'output' => 'Skipped (no email/password supplied).'];
    }

    // 6) Cache compiled configuration and views (route caching is skipped:
    //    the app defines closure routes which cannot be serialized).
    $results['config:cache'] = sm_artisan('config:cache');
    $results['view:cache'] = sm_artisan('view:cache');
}

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>SalesMgt Installer</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 760px; padding: 0 1rem; color: #18181b; }
        h1 { font-size: 1.35rem; }
        .warn { background: #fef3c7; border: 1px solid #f59e0b; padding: .75rem 1rem; border-radius: .5rem; }
        .ok { color: #166534; }
        .fail { color: #b91c1c; }
        form { border: 1px solid #e4e4e7; border-radius: .75rem; padding: 1rem 1.25rem; margin-top: 1rem; }
        label { display: block; margin-top: .75rem; font-weight: 600; font-size: .85rem; }
        input { width: 100%; padding: .5rem; margin-top: .25rem; border: 1px solid #d4d4d8; border-radius: .5rem; }
        button { margin-top: 1rem; padding: .6rem 1.1rem; border: 0; border-radius: .5rem; background: #0d9488; color: #fff; font-weight: 600; cursor: pointer; }
        pre { background: #f4f4f5; padding: .75rem; border-radius: .5rem; overflow: auto; white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>SalesMgt Installer</h1>

    <p class="warn">
        Delete <code>install.php</code> from the server as soon as the install completes.
    </p>

    <?php if ($results !== []): ?>
        <h2>Results</h2>
        <?php foreach ($results as $label => $result): ?>
            <p class="<?= $result['ok'] ? 'ok' : 'fail' ?>">
                <strong><?= htmlspecialchars($label, ENT_QUOTES) ?>:</strong>
                <?= $result['ok'] ? 'OK' : 'FAILED' ?>
            </p>
            <?php if ($result['output'] !== ''): ?>
                <pre><?= htmlspecialchars($result['output'], ENT_QUOTES) ?></pre>
            <?php endif; ?>
        <?php endforeach; ?>
    <?php endif; ?>

    <form method="post">
        <input type="hidden" name="action" value="run">
        <input type="hidden" name="key" value="<?= htmlspecialchars($providedKey, ENT_QUOTES) ?>">

        <label>Installer key</label>
        <input value="<?= htmlspecialchars($providedKey, ENT_QUOTES) ?>" disabled>

        <label>Super Admin name (optional)</label>
        <input name="admin_name" placeholder="Platform Owner">

        <label>Super Admin email (optional)</label>
        <input name="admin_email" type="email" placeholder="owner@example.com">

        <label>Super Admin password (optional, min 8 chars)</label>
        <input name="admin_password" type="password" placeholder="At least 8 characters">

        <button type="submit">Run installer</button>
    </form>
</body>
</html>
