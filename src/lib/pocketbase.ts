// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import PocketBase from "pocketbase";

const pb = new PocketBase(import.meta.env["VITE_POCKETBASE_URL"] as string | undefined);

pb.autoCancellation(false);

export default pb;
