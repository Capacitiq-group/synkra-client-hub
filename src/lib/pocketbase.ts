// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import PocketBase from "pocketbase";

const pocketBaseUrl = import.meta.env["VITE_POCKETBASE_URL"] as string | undefined;

if (!pocketBaseUrl) {
  console.warn("VITE_POCKETBASE_URL is not set. PocketBase will not connect.");
}

const pb = new PocketBase(pocketBaseUrl || "http://localhost:8090");

pb.autoCancellation(false);

export default pb;
