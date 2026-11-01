# medbrains-sdk (Python)

Build extensions for [MedBrains](https://github.com/medbrains/medbrains), the open hospital OS.
Protocol: [`docs/extensions/PROTOCOL.md`](../../docs/extensions/PROTOCOL.md). Standard library
only; Python 3.10+.

```sh
pip install medbrains-sdk
```

```python
from medbrains_sdk import MedBrainsClient, MedBrainsError, verify_signature

client = MedBrainsClient("https://hospital.example", client_id, client_secret)
patient = client.read_fhir("Patient", patient_id)  # token fetched, cached, refreshed

# In your webhook handler — verify against the RAW body:
check = verify_signature(webhook_secret, request.headers.get("X-MedBrains-Signature"), raw_body)
if not check.ok:
    return 401, check.reason
```

`MedBrainsError.status`: `403` missing permission, `404` a record you may not see, `503` the
hospital could not decide (retry; never treat as "no data").

## Testing with the mock

```python
from medbrains_sdk import MedBrainsClient, MockMedBrains

with MockMedBrains(permissions=["patients.view"], resources={"Patient": {"p1": {"resourceType": "Patient", "id": "p1"}}}) as mock:
    client = MedBrainsClient(mock.url, mock.client_id, mock.client_secret)
    assert client.read_fhir("Patient", "p1")["id"] == "p1"
    mock.deliver("http://127.0.0.1:8787/hook", "patient.created", {"patient_id": "p1"})  # signed
    mock.revoke()  # the next call is refused
```

Run the tests: `python3 -m unittest discover -s tests`.

The manifest and the `medbrains ext` CLI (init, validate, conformance test) live in the TypeScript
package [`@medbrains/sdk`](../../packages/sdk).
