# SalesMgt — cPanel Deployment Guide

Deploy the React SPA and the Laravel 12 API on **one domain** on cPanel / shared
hosting, with the Laravel application kept **outside** the web root.

```
~/ (cPanel home)
├── salesmgt/                 ← Laravel app  (uploaded from release/api)
│   ├── app/ bootstrap/ config/ database/ routes/ storage/ vendor/ artisan …
│   └── .env                  ← production environment file
└── public_html/              ← document root (uploaded from release/public_html)
    ├── index.html            ← SPA shell
    ├── assets/ …             ← hashed SPA assets
    ├── .htaccess             ← routes /api → index.php, else SPA
    ├── index.php             ← Laravel front controller (boots ../salesmgt)
    ├── install.php           ← one-time installer (DELETE when done)
    └── storage → ../salesmgt/storage/app/public   (symlink)
```

Request flow:

| Request | Served by |
| --- | --- |
| `GET /` and client routes (`/pos`, `/products` …) | SPA `index.html` |
| `GET /assets/*`, `/icons/*`, `/sw.js` | static files |
| `GET /storage/*` | uploaded files via the `storage` symlink |
| `/api/v1/*` and `/up` | Laravel `index.php` |

---

## 1. Requirements

Ask the host (or confirm in cPanel) that you have:

- **PHP 8.2+** (8.3 recommended) via *MultiPHP Manager*.
- PHP extensions: `bcmath ctype curl dom fileinfo json mbstring openssl
  pdo_mysql tokenizer xml zip`.
- A **MySQL database + user** (*MySQL® Databases*).
- **HTTPS** enabled — run *SSL/TLS Status → Run AutoSSL* (Let's Encrypt).
- Ability to create **Cron Jobs**.

> The build uses **MySQL** (`DB_CONNECTION=mysql`). SQLite is not used.

---

## 2. Build the release bundle (on your computer)

```powershell
# Windows
pwsh scripts/build-release.ps1
```
```bash
# macOS / Linux
bash scripts/build-release.sh
```

This produces:

- `release/api` — the Laravel app **including `vendor/`** (no Composer needed on the server).
- `release/public_html` — the compiled SPA plus `.htaccess`, `index.php`, `install.php`.
- `release.zip` — both folders zipped.

---

## 3. Create the database

In *cPanel → MySQL® Databases*:

1. Create a database, e.g. `USERNAME_salesmgt`.
2. Create a user with a strong password.
3. Add the user to the database with **All Privileges**.

Note the database name, username and password — you need them in step 5.

---

## 4. Upload the files

Using *cPanel → File Manager* (or FTP), upload and extract so that the final
layout matches the diagram above:

1. Upload `release/api` **contents** to a new folder `~/salesmgt`
   (a sibling of `public_html`, **not** inside it).
2. Upload `release/public_html` **contents** into `~/public_html`.

> If your Laravel folder ends up somewhere else, edit the `$appBasePath` value
> near the top of `public_html/index.php` (and `install.php`) to match.

---

## 5. Configure the environment

1. In `~/salesmgt`, copy `.env.example` to `.env`.

   Or upload `backend/.env.production.example` to `~/salesmgt/.env`.

2. Edit `~/salesmgt/.env` and set at minimum:

   ```ini
   APP_ENV=production
   APP_DEBUG=false
   APP_URL=https://app.example.com
   FRONTEND_URL=https://app.example.com

   DB_DATABASE=USERNAME_salesmgt
   DB_USERNAME=USERNAME_salesmgt
   DB_PASSWORD="your-db-password"

   MAIL_HOST= …
   MAIL_PORT=465
   MAIL_SCHEME=smtps
   MAIL_USERNAME= …
   MAIL_PASSWORD= …
   MAIL_FROM_ADDRESS="no-reply@app.example.com"

   SANCTUM_STATEFUL_DOMAINS=app.example.com
   CORS_ALLOWED_ORIGINS=https://app.example.com
   ```

   Leave `APP_KEY=` empty — it is generated in the next step.

---

## 6. Run the installer

### Option A — cPanel Terminal / SSH (preferred)

```bash
cd ~/salesmgt
php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=RoleAndPermissionSeeder --force
php artisan db:seed --class=PlanSeeder --force
php artisan storage:link            # creates ~/salesmgt/public/storage (see note)
php artisan config:cache
php artisan view:cache
ln -s ~/salesmgt/storage/app/public ~/public_html/storage   # web-accessible files
```

### Option B — web installer (no SSH)

1. Edit `~/public_html/install.php` and set a strong `$expectedKey`
   (or set the `SALESMGT_INSTALL_KEY` environment variable).
2. Visit `https://app.example.com/install.php?key=YOUR_SECRET`.
3. Optionally fill in a Super Admin email/password, then click **Run installer**.
4. **Delete `install.php` immediately afterwards.**

> `route:cache` is intentionally skipped: the API defines closure routes
> (`/api/v1/health`, `/up`) which cannot be serialized.

> Do **not** run the default `db:seed` / `DatabaseSeeder` — it loads demo data.
> The installer only seeds roles/permissions and subscription plans.

---

## 7. Permissions

Make these writable by PHP (usually `755`, sometimes `775`):

```
~/salesmgt/storage            (and everything inside)
~/salesmgt/bootstrap/cache
```

In *File Manager*, right-click each folder → *Change Permissions*.

---

## 8. First account

- Visit `https://app.example.com/register` to create your business and its
  **Business Admin** account (recommended), **or**
- use the Super Admin created by the installer to sign in and manage tenants.

---

## 9. Cron job (required for the billing scheduler)

*cPanel → Cron Jobs → Add New Cron Job* (once per minute):

```
* * * * * cd /home/USERNAME/salesmgt && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1
```

Confirm the PHP path with your host (often `/usr/local/bin/php` or a versioned
path like `/usr/local/bin/php82`). See `deploy/cpanel/cron.txt`.

---

## 10. Hardening checklist

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` uses `https://`.
- [ ] `install.php` deleted from `public_html`.
- [ ] `~/salesmgt/.env` is **not** inside `public_html` and has mode `600`/`644`.
- [ ] HTTPS working; then enable the HSTS header in `public_html/.htaccess`.
- [ ] `php artisan config:cache` run **after** the final `.env` edits.
- [ ] Cron job for `schedule:run` active.
- [ ] `public_html/storage` symlink exists (uploaded product images load).

---

## 11. Updating an existing deployment

```bash
cd ~/salesmgt
# upload the new release over ~/salesmgt and ~/public_html first
php artisan migrate --force
php artisan config:cache
php artisan view:cache
php artisan queue:restart   # harmless with the sync driver
```

The SPA service worker updates automatically (the `sw.js` file is served with
`no-store`, so users receive the new build on their next visit).

---

## 12. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `500` on `/` | `index.html` missing, or `DirectoryIndex` overridden. Confirm `public_html/.htaccess` is present and `index.html` exists. |
| `500` on `/api/*` | Check `~/salesmgt/storage/logs/laravel.log`. Usually `APP_KEY` missing, wrong DB credentials, or `storage/` not writable. |
| API `404` | The Laravel folder path in `index.php` is wrong, or `.htaccess` was not uploaded (dot-files are hidden in File Manager). |
| CORS / 419 errors | Ensure `SANCTUM_STATEFUL_DOMAINS` and `CORS_ALLOWED_ORIGINS` match the exact host. |
| Uploaded images 404 | Recreate the `public_html/storage` symlink. |
| Password-reset email not received | Verify the `MAIL_*` values; `MAIL_SCHEME=smtps` for port `465`. |
| Blank page after deploy | Clear the browser cache / unregister the old service worker once. |

Logs: `~/salesmgt/storage/logs/laravel.log`.
