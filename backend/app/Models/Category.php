<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'name'];
}