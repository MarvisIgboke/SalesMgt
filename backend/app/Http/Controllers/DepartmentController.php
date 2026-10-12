<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->can('departments.view'), 403);

        $includeCounts = $request->boolean('with_counts');

        $departments = Department::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Department $department) => $department->toApi($includeCounts));

        return ApiResponse::success($departments);
    }

    public function store(Request $request)
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $department = Department::query()->create([
            'business_id' => $request->user()->business_id,
            'name' => trim($data['name']),
            'code' => $data['code'] ?? null,
            'description' => $data['description'] ?? null,
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        AuditLog::record('department.created', 'department', $department->id, ['name' => $department->name]);

        return ApiResponse::success($department->toApi(true), 'Department created.');
    }

    public function update(Request $request, Department $department)
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $department->fill([
            'name' => isset($data['name']) ? trim($data['name']) : $department->name,
            'code' => array_key_exists('code', $data) ? $data['code'] : $department->code,
            'description' => array_key_exists('description', $data) ? $data['description'] : $department->description,
            'is_active' => isset($data['is_active']) ? (bool) $data['is_active'] : $department->is_active,
        ])->save();

        AuditLog::record('department.updated', 'department', $department->id, ['name' => $department->name]);

        return ApiResponse::success($department->toApi(true), 'Department updated.');
    }

    public function destroy(Request $request, Department $department)
    {
        abort_unless($request->user()->can('departments.manage'), 403);

        $staffCount = $department->staff()->count();
        $productCount = $department->products()->count();

        if ($staffCount > 0 || $productCount > 0) {
            throw new ApiException(
                'DEPARTMENT_IN_USE',
                "This department is used by {$staffCount} staff and {$productCount} products.",
                422,
            );
        }

        $name = $department->name;
        $department->delete();

        AuditLog::record('department.deleted', 'department', null, ['name' => $name]);

        return ApiResponse::success(null, 'Department deleted.');
    }
}