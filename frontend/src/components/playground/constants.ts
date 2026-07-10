export const initialInputJson = `{
  "service": "checkout-api",
  "region": "us-east-1",
  "retry": true,
  "timeoutMs": 2500,
  "owners": [
    "platform",
    "payments"
  ]
}`;

export const diffBeforeJson = `{
  "status": "draft",
  "plan": "starter",
  "user": {
    "role": "viewer",
    "seats": 3
  },
  "features": {
    "auditLog": false,
    "webhooks": false
  }
}`;

export const diffAfterJson = `{
  "status": "ready",
  "plan": "pro",
  "user": {
    "role": "admin",
    "seats": 10
  },
  "features": {
    "auditLog": true,
    "webhooks": true
  },
  "timeoutMs": 3000
}`;

export const patchDocumentJson = diffBeforeJson;

export const pointerDocumentJson = `{
  "user": {
    "id": 102483,
    "username": "coder_dev_703",
    "role": "Administrator"
  },
  "permissions": [
    "read",
    "write",
    "execute"
  ],
  "metadata": {
    "lastLogin": "2026-07-05T14:56:00Z"
  }
}`;

export const pointerPathInput = "/user/role";

export const patchOperationsJson = `[
  {
    "op": "replace",
    "path": "/status",
    "value": "ready"
  },
  {
    "op": "replace",
    "path": "/plan",
    "value": "pro"
  },
  {
    "op": "replace",
    "path": "/user/seats",
    "value": 10
  },
  {
    "op": "replace",
    "path": "/features/auditLog",
    "value": true
  },
  {
    "op": "replace",
    "path": "/features/webhooks",
    "value": true
  },
  {
    "op": "add",
    "path": "/timeoutMs",
    "value": 3000
  }
]`;
