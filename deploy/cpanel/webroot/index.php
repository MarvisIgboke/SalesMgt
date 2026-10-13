<?php

/**
 * SalesMgt - Laravel front controller for cPanel shared hosting.
 * -----------------------------------------------------------------------------
 * This file is uploaded to the document root (public_html). It boots the
 * Laravel application from `../salesmgt` (kept OUTSIDE the web root for
 * security) and handles the requests that .htaccess forwards here (everything
 * under /api and /up).
 *
 * The public/ directory of the Laravel app is NOT used as the document root in
 * this layout; static SPA files are served directly by Apache.
 */

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

/*
| Adjust this path only if your Laravel app lives somewhere else.
| Default assumption: `public_html/` and `salesmgt/` are siblings in the
| cPanel home directory.
*/
$appBasePath = dirname(__DIR__) . '/salesmgt';

if (file_exists($maintenance = $appBasePath . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $appBasePath . '/vendor/autoload.php';

/** @var Application $app */
$app = require_once $appBasePath . '/bootstrap/app.php';

$app->handleRequest(Request::capture());
