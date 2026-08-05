// SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.
import PocketBase from "pocketbase";

const pbUrl = import.meta.env["VITE_POCKETBASE_URL"] as string | undefined;

if (!pbUrl) {
  console.warn(
    "[Synkra] VITE_POCKETBASE_URL is not set. " +
      "Set it as a build argument in Coolify pointing to https://pb.synkra.co.za",
  );
}

const pb = new PocketBase(pbUrl || "http://localhost:8090");
pb.autoCancellation(false);

export default pb;
