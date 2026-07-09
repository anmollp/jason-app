export const initialInputJson = `{
  "service": "billing",
  "region": "us-east-1",
  "retry": true
}`;

export const diffBeforeJson = `{
  "status": "draft",
  "plan": "starter",
  "user": {
    "role": "viewer"
  }
}`;

export const diffAfterJson = `{
  "status": "ready",
  "plan": "pro",
  "user": {
    "role": "admin"
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
    "op": "add",
    "path": "/timeoutMs",
    "value": 3000
  }
]`;
