import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Guide() {
  const { user } = useAuth();

  return (
    <div className="page">
      <div className="page-header">
        <h1>User guide</h1>
      </div>

      <p className="guide-intro">
        Belong keeps your church's members, households, ministries, visitors and attendance in one place.
        Here's what each part of the app does.
      </p>

      <div className="guide">
        <details open>
          <summary>Getting started</summary>
          <ul>
            <li>
              Add people one at a time from <strong>Members &rarr; Add member</strong>, or load a whole
              spreadsheet at once from <Link to="/members/import">Import</Link>.
            </li>
            <li>
              The <Link to="/dashboard">Dashboard</Link> shows totals, membership growth, recent attendance
              and this week's birthdays at a glance.
            </li>
            <li>
              Your account runs on a monthly subscription that starts with a free trial &mdash; see{" "}
              <Link to="/billing">Billing</Link> for status and payment.
            </li>
          </ul>
        </details>

        <details>
          <summary>Members</summary>
          <p>
            Each member record holds personal and contact details, a membership status (Visitor, New
            convert, Member or Inactive), key dates such as date joined and baptism, occupation, an
            emergency contact, and an optional photo.
          </p>
          <ul>
            <li>
              <strong>Search and filter</strong> the list by name, status or ministry; long lists are
              split into pages.
            </li>
            <li>
              Assign a member to a <strong>household</strong> and to one or more <strong>ministries</strong>{" "}
              on the same form.
            </li>
            <li>
              Typing a new household name on the member form creates that household automatically &mdash;
              there's no need to set it up first.
            </li>
          </ul>
        </details>

        <details>
          <summary>Households &amp; ministries</summary>
          <ul>
            <li>
              <strong>Households</strong> group family members together. They're created from the member
              form or during import.
            </li>
            <li>
              <strong>Ministries</strong> (Choir, Ushering, Youth, and so on) are assigned per member, and
              one member can belong to several.
            </li>
            <li>The Dashboard's "Members by ministry" chart shows how people are spread across them.</li>
          </ul>
        </details>

        <details>
          <summary>Visitors</summary>
          <p>
            Visitors can check themselves in from a QR code or link with no login. Their details arrive in
            the <Link to="/visitors">Visitors</Link> queue for your team to review.
          </p>
          <ul>
            <li>
              <strong>Convert</strong> a check-in to create a member record from their details, or{" "}
              <strong>dismiss</strong> it.
            </li>
            <li>
              You can turn the public check-in link on or off, and rotate it if it's ever shared too
              widely.
            </li>
          </ul>
        </details>

        <details>
          <summary>Attendance</summary>
          <p>
            On the <Link to="/attendance">Attendance</Link> page, create a service for a date and type
            (Sunday, Midweek or Special), optionally name the event (for example "Mother's Day"), then
            check members in.
          </p>
          <ul>
            <li>
              Enter a <strong>visitor headcount</strong> for a service when you don't have individual
              names.
            </li>
            <li>
              The monthly summary shows <strong>average attendance</strong> &mdash; counted only over
              services that were actually taken &mdash; alongside visitor numbers per service.
            </li>
          </ul>
        </details>

        <details>
          <summary>Importing from a spreadsheet</summary>
          <p>
            Use <Link to="/members/import">Import</Link> to bulk-load members while digitising paper
            records.
          </p>
          <ul>
            <li>Download the template, fill it in, and upload it.</li>
            <li>Household and ministry names in the file are matched to existing ones or created as needed.</li>
            <li>Rows are processed one by one, so a bad row is reported on its own and doesn't stop the rest.</li>
          </ul>
        </details>

        <details>
          <summary>Reports</summary>
          <p>
            The <Link to="/reports">Reports</Link> page has five reports you can filter, then download as CSV or
            print (use your browser's "Save as PDF" in the print dialog):
          </p>
          <ul>
            <li>
              <strong>Attendance summary</strong> — totals and averages by service type over a date range, next to
              the previous period of the same length.
            </li>
            <li>
              <strong>Absentee / at-risk list</strong> — members who used to attend but haven't been recorded
              present in the last few weeks (default 6), for follow-up.
            </li>
            <li>
              <strong>Member directory</strong> — the full roster with households and ministries.
            </li>
            <li>
              <strong>Birthdays &amp; anniversaries</strong> — birthdays, baptism anniversaries and membership
              anniversaries for a chosen month.
            </li>
            <li>
              <strong>Ministry roster</strong> — members in each ministry with their contact details.
            </li>
          </ul>
        </details>

        <details>
          <summary>Billing &amp; subscription</summary>
          <p>Belong is a monthly subscription that starts with a free trial.</p>
          <ul>
            <li>
              Pay by MMG mobile money, then submit the transaction reference on the{" "}
              <Link to="/billing">Billing</Link> page.
            </li>
            <li>Your account keeps working while a submitted payment is being verified.</li>
            <li>A reminder banner appears in the days before renewal and during a short grace period after it.</li>
          </ul>
        </details>

        {user?.is_superadmin && (
          <details>
            <summary>Admin console</summary>
            <p>
              As a platform operator you can see every church from the <Link to="/admin">Admin</Link> page
              and verify payments, extend trials or cancel accounts across all of them.
            </p>
          </details>
        )}
      </div>

      <p className="guide-footer">Need more help? Contact your church administrator.</p>
    </div>
  );
}
