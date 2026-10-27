# Node offline certificate storage

This private, Node-only adapter stores signed certificate bytes in a caller-provided directory. It hashes cache keys into filenames, writes with mode `0600`, and atomically replaces entries. Use a private directory; disk storage is not encrypted. `OfflineCertificateCache` still verifies the signature, fingerprint, and expiry on every read.
