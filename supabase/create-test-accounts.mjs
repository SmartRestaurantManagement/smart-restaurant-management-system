// One-off script: creates the 5 staff/admin + 18 customer test accounts via
// the Supabase Admin API (goes through GoTrue properly - real password auth,
// real auth.identities row, works with password reset/OTP), then inserts
// their matching public.profiles row.
//
// Run this BEFORE supabase/seed-90-day-history.sql - that script looks up
// existing staff/customer profiles by role, it no longer creates them itself.
//
// Passes role/restaurant_id/full_name via user_metadata so that if the
// on_auth_user_created trigger (see migrations/..._auto_create_profile_on_signup.sql)
// already exists when this runs, it creates the profile with the correct
// role itself - this script's own profile insert below then just sees it
// already exists (correctly) and skips, rather than being stuck at the
// trigger's 'customer' default.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never committed - the
// key is only read from env, never hardcoded here).
//
// Run with: node supabase/create-test-accounts.mjs

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Shared test password for every account this script creates - not secret,
// just a known login for testing.
const TEST_PASSWORD = "KaizenDemo123!";

const PEOPLE = [
  { email: "ananya.rao@kaizen.demo", full_name: "Ananya Rao — Manager", role: "admin" },
  { email: "vikram.singh@kaizen.demo", full_name: "Chef Vikram Singh", role: "staff" },
  { email: "ritu.desai@kaizen.demo", full_name: "Chef Ritu Desai", role: "staff" },
  { email: "arjun.mehta@kaizen.demo", full_name: "Arjun Mehta", role: "staff" },
  { email: "sneha.kulkarni@kaizen.demo", full_name: "Sneha Kulkarni", role: "staff" },
  { email: "rohan.kapoor@kaizen.demo", full_name: "Rohan Kapoor", role: "customer" },
  { email: "priya.nair@kaizen.demo", full_name: "Priya Nair", role: "customer" },
  { email: "aditya.bhatt@kaizen.demo", full_name: "Aditya Bhatt", role: "customer" },
  { email: "meera.iyer@kaizen.demo", full_name: "Meera Iyer", role: "customer" },
  { email: "karan.malhotra@kaizen.demo", full_name: "Karan Malhotra", role: "customer" },
  { email: "sanya.gupta@kaizen.demo", full_name: "Sanya Gupta", role: "customer" },
  { email: "rahul.verma@kaizen.demo", full_name: "Rahul Verma", role: "customer" },
  { email: "ishita.sharma@kaizen.demo", full_name: "Ishita Sharma", role: "customer" },
  { email: "devansh.patel@kaizen.demo", full_name: "Devansh Patel", role: "customer" },
  { email: "nikita.joshi@kaizen.demo", full_name: "Nikita Joshi", role: "customer" },
  { email: "aryan.chawla@kaizen.demo", full_name: "Aryan Chawla", role: "customer" },
  { email: "pooja.reddy@kaizen.demo", full_name: "Pooja Reddy", role: "customer" },
  { email: "siddharth.rao@kaizen.demo", full_name: "Siddharth Rao", role: "customer" },
  { email: "tanvi.mehta@kaizen.demo", full_name: "Tanvi Mehta", role: "customer" },
  { email: "yash.agarwal@kaizen.demo", full_name: "Yash Agarwal", role: "customer" },
  { email: "riya.sen@kaizen.demo", full_name: "Riya Sen", role: "customer" },
  { email: "kabir.khanna@kaizen.demo", full_name: "Kabir Khanna", role: "customer" },
  { email: "anjali.pillai@kaizen.demo", full_name: "Anjali Pillai", role: "customer" },
];

async function findRestaurantId() {
  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No restaurant found in public.restaurants.");
  return data.id;
}

async function main() {
  const restaurantId = await findRestaurantId();
  console.log(`Using restaurant_id: ${restaurantId}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const person of PEOPLE) {
    let userId = null;

    const { data, error } = await supabase.auth.admin.createUser({
      email: person.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: person.full_name, role: person.role, restaurant_id: restaurantId },
    });

    if (error) {
      // This project's GoTrue admin listUsers endpoint returns a hard 500
      // ("Database error finding users"), so there's no reliable way to
      // look up an existing user's id by email here. If createUser reports
      // a duplicate, we can only skip - not reconcile their profile.
      const isDuplicate = /already.*registat|already.*exist|duplicate/i.test(error.message || "");
      if (isDuplicate) {
        console.warn(`SKIPPED ${person.email}: account already exists, but its id can't be looked up (listUsers is broken on this project) - resolve manually if needed.`);
      } else {
        console.error(`FAILED auth user ${person.email}: ${error.message}`);
      }
      failed += 1;
      continue;
    }

    userId = data.user.id;
    console.log(`Created auth user: ${person.email}`);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        restaurant_id: restaurantId,
        role: person.role,
        full_name: person.full_name,
      });
      if (profileError) {
        console.error(`FAILED profile ${person.email}: ${profileError.message}`);
        failed += 1;
      } else {
        console.log(`  -> profile created (${person.role})`);
        created += 1;
      }
    } else {
      console.log(`  -> profile already exists`);
      skipped += 1;
    }
  }

  console.log(`\nDone. ${created} profiles created, ${skipped} already existed, ${failed} failed.`);
  console.log(`Shared test password for all accounts created by this script: ${TEST_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
