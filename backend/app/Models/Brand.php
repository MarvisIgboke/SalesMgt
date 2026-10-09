<?php

namespace App\Models;

use App\Support\BelongsToBusiness;
use Illuminate\Database\Eloquent\Model;

class Brand extends Model
{
    use BelongsToBusiness;

    protected $fillable = ['business_id', 'name'];
}