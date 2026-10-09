<?php

namespace App\Exceptions;

use RuntimeException;

class ApiException extends RuntimeException
{
    private string $errorCode;

    private int $httpStatus;

    private array $errors = [];

    public function __construct(string $code, string $message, int $status = 400, array $errors = [])
    {
        parent::__construct($message);

        $this->errorCode = $code;
        $this->httpStatus = $status;
        $this->errors = $errors;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getStatusCode(): int
    {
        return $this->httpStatus;
    }

    public function toArray(): array
    {
        $payload = [
            'success' => false,
            'code' => $this->errorCode,
            'message' => $this->getMessage(),
        ];

        if ($this->errors !== []) {
            $payload['errors'] = $this->errors;
        }

        return $payload;
    }
}