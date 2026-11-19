# Bianco Fit — Security Specification & Threat Model (Phase 0)

## 1. Data Invariants

1. **Strict Ownership, Verified Identity & Access Control (RBAC)**:
   - Every document in `/users/{userId}` can be read by the email-verified owner (`request.auth.uid == userId`) or an email-verified administrator (`isAdmin()`).
   - Listing `/users` is strictly restricted to bootstrapped email-verified administrators (`contato.servicosgama@gmail.com` and `contato.businessgama@gmail.com`) without any `get()`/`exists()` fan-out.
   - New user profiles MUST initialize `email` matching `request.auth.token.email.lower()`, optional normalized `username` (`^[a-z0-9._\-]+$`, 2–40 chars), and non-admin accounts MUST initialize `role: 'user'` and `status: 'pendente'`. Only bootstrapped admins may initialize `role: 'admin'` and `status: 'autorizado'`.
   - Non-admin users can NEVER modify `role`, `status`, `email`, or `username` on update.
   - Admins may update ONLY `['role', 'status', 'updatedAt']` on student profiles and cannot demote or block their own active admin account.
2. **Authorized Subcollection Gate (Master Gate)**:
   - Creating, updating, reading (single doc), or deleting a document in any subcollection (`nutrition`, `dailyWaterLogs`, `savedWorkouts`, `workoutSessions`, `exerciseLoads`, `bodyMeasurements`, `aiChatMessages`, `achievements`) requires the parent `/users/{userId}` document to exist AND have `status == 'autorizado'` (or be a bootstrapped admin).
   - Subcollection `list` queries strictly verify `isVerifiedOwner(userId) && resource.data.userId == request.auth.uid` without costly `get()`/`exists()` fan-out.
3. **Immutable Ownership & Timestamps**: `ownerId` / `userId` and `createdAt` can never be changed on update. Creation timestamps must equal `request.time`; update timestamps must equal `request.time`.
4. **Strict Key & Volumetric Guards**: Every create checks `hasAll` and `hasOnly` against allowed schema keys; every update uses named actions with `affectedKeys().hasOnly(...)`; every string and array has bounded `.size()` checks; every document ID matches `^[a-zA-Z0-9_\-]+$` with max length 128.
5. **Bounded Arrays**: `secondaryGoals` is strictly capped at `<= 2` strings; `matchedExerciseIds` is strictly capped at `<= 20` valid exercise IDs.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Cross-User Profile Read**: Non-admin User B attempts `get(/users/userA)` or `list(/users)` -> DENIED.
2. **Self-Assigned Admin / Auto-Approval on Create**: Regular User A creates `/users/userA` with `role: "admin"` or `status: "autorizado"` -> DENIED.
3. **Privilege Escalation on Update**: Regular User A updates `/users/userA` attempting to change `role` to `"admin"` or `status` to `"autorizado"` -> DENIED (`affectedKeys().hasOnly` rejects).
4. **Unverified Admin Email Spoofing**: User with `email: "contato.servicosgama@gmail.com"` and `email_verified: false` attempts `list(/users)` or admin update -> DENIED (`isVerifiedUser()` rejects).
5. **Blocked / Pending Subcollection Write**: User A with `status: "pendente"` or `status: "bloqueado"` attempts to create `/users/userA/workoutSessions/s1` -> DENIED (`isAuthorizedUserProfile` rejects).
6. **Shadow Field Injection (Ghost Field)**: User A creates `/users/userA` with extra field `isAdmin: true` -> DENIED (`hasOnly` rejects).
7. **ID Poisoning**: User A attempts write to `/users/userA/workoutSessions/../../evil..id` or a 200-char ID -> DENIED (`isValidId` rejects).
8. **Oversized String (Denial of Wallet)**: User A writes `customGoalText` with 5,000 characters -> DENIED (`.size() <= 600` rejects).
9. **Unbounded / Poisoned Array**: User A writes `secondaryGoals` with 5 items or non-string elements `[12345]` -> DENIED (`isValidSecondaryGoals` rejects).
10. **Client Timestamp Forgery**: User A creates `/users/userA/bodyMeasurements/m2` with backdated `createdAt` (`!= request.time`) -> DENIED.
11. **Immortal Field Mutation**: User A or Admin updates `/users/userA` attempting to change `ownerId`, `createdAt`, or `email` -> DENIED.
12. **Admin Scope Overreach**: Admin attempts to overwrite a student's `fullName` or `customGoalText` instead of only `['role', 'status', 'updatedAt']` -> DENIED.
