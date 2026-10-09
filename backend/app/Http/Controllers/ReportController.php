<?php

namespace App\Http\Controllers;

use App\Services\ReportService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reports)
    {
    }

    public function show(Request $request)
    {
        abort_unless($request->user()->can('reports.view'), 403);

        $params = $request->validate([
            'report_type' => ['nullable', 'string', 'max:60'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'product_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'staff_id' => ['nullable', 'integer'],
            'customer_id' => ['nullable', 'integer'],
            'payment_method' => ['nullable', 'string', 'max:40'],
            'group_by' => ['nullable', 'string', 'max:20'],
        ]);

        return ApiResponse::success($this->reports->build($params));
    }

    public function export(Request $request, string $format)
    {
        abort_unless($request->user()->can('reports.view'), 403);
        abort_unless(in_array($format, ['pdf', 'excel', 'csv'], true), 404);

        $params = $request->validate([
            'report_type' => ['nullable', 'string', 'max:60'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'branch_id' => ['nullable', 'integer'],
            'group_by' => ['nullable', 'string', 'max:20'],
        ]);

        $dataset = $this->reports->build($params);
        $filename = str_replace('-', '_', $dataset['report_type']).'_'.now()->format('Ymd_His').'.csv';

        Storage::disk('public')->put('reports/'.$filename, $this->toCsv($dataset));

        return ApiResponse::success([
            'url' => Storage::disk('public')->url('reports/'.$filename),
            'filename' => $filename,
            'format' => $format,
            'title' => $dataset['title'],
        ], 'Export ready.');
    }

    public function download(Request $request, string $file)
    {
        abort_unless($request->user()->can('reports.view'), 403);
        abort_if(str_contains($file, '..') || str_contains($file, '/') || str_contains($file, '\\'), 404);

        $path = 'reports/'.$file;

        abort_unless(Storage::disk('public')->exists($path), 404);

        return Storage::disk('public')->download($path);
    }

    private function toCsv(array $dataset): string
    {
        $handle = fopen('php://temp', 'r+');

        if ($dataset['columns'] !== []) {
            fputcsv($handle, $dataset['columns']);
        }

        foreach ($dataset['rows'] as $row) {
            $line = [];
            foreach ($dataset['columns'] as $column) {
                $line[] = is_array($row) ? ($row[$column] ?? '') : '';
            }
            fputcsv($handle, $line);
        }

        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv === false ? '' : $csv;
    }
}
