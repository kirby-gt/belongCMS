import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

const emptyForm = {
  full_name: "",
  date_of_birth: "",
  gender: "",
  marital_status: "",
  phone: "",
  email: "",
  address: "",
  membership_status: "Visitor",
  date_joined: "",
  baptism_date: "",
  occupation: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  household_id: "",
  ministry_ids: [] as string[],
  photo_url: "",
};

export default function MemberForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...emptyForm });
  const [households, setHouseholds] = useState<any[]>([]);
  const [ministries, setMinistries] = useState<any[]>([]);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.getHouseholds().then(setHouseholds);
    api.getMinistries().then(setMinistries);
    if (isEdit && id) {
      api.getMember(id).then((m) =>
        setForm({
          ...emptyForm,
          ...m,
          date_of_birth: m.date_of_birth?.slice(0, 10) || "",
          date_joined: m.date_joined?.slice(0, 10) || "",
          baptism_date: m.baptism_date?.slice(0, 10) || "",
          household_id: m.household_id || "",
          ministry_ids: m.ministries?.map((mi: any) => mi.id) || [],
        })
      );
    }
  }, [id]);

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleMinistry(ministryId: string) {
    setForm((f) => ({
      ...f,
      ministry_ids: f.ministry_ids.includes(ministryId)
        ? f.ministry_ids.filter((id) => id !== ministryId)
        : [...f.ministry_ids, ministryId],
    }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return; // Must save the member first before uploading
    setUploading(true);
    setError("");
    try {
      const res = await api.uploadMemberPhoto(id, file);
      update("photo_url", res.photo_url);
    } catch (err: any) {
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      let householdId = form.household_id;
      if (newHouseholdName.trim()) {
        const household = await api.createHousehold({ name: newHouseholdName.trim() });
        householdId = household.id;
      }

      const payload = {
        ...form,
        household_id: householdId || null,
        date_of_birth: form.date_of_birth || null,
        date_joined: form.date_joined || null,
        baptism_date: form.baptism_date || null,
        gender: form.gender || null,
        marital_status: form.marital_status || null,
      };

      if (isEdit && id) {
        await api.updateMember(id, payload);
      } else {
        await api.createMember(payload);
      }
      navigate("/members");
    } catch (err: any) {
      setError(err.message || "Failed to save member");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1>{isEdit ? "Edit member" : "New member"}</h1>
      {error && <p className="error">{error}</p>}

      {isEdit && (
        <div className="photo-block">
          {form.photo_url ? (
            <img
              className="photo-thumb"
              src={`${import.meta.env.VITE_API_URL || "http://localhost:3001"}${form.photo_url}`}
              alt="Profile"
            />
          ) : (
            <div className="photo-thumb photo-thumb-empty">No photo</div>
          )}
          <label className="photo-upload-btn">
            {uploading ? "Uploading…" : "Upload photo"}
            <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={uploading} />
          </label>
        </div>
      )}

      <form className="member-form" onSubmit={handleSubmit}>
        <h2>Personal info</h2>
        <div className="form-row">
          <div>
            <label>Full name</label>
            <input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </div>
          <div>
            <label>Date of birth</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Gender</label>
            <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
              <option value="">Not specified</option>
              <option>Female</option>
              <option>Male</option>
            </select>
          </div>
          <div>
            <label>Marital status</label>
            <select value={form.marital_status} onChange={(e) => update("marital_status", e.target.value)}>
              <option value="">Not specified</option>
              <option>Single</option>
              <option>Married</option>
              <option>Widowed</option>
              <option>Divorced</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label>Email (optional)</label>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
        </div>

        <label>Address</label>
        <input value={form.address} onChange={(e) => update("address", e.target.value)} />

        <h2>Membership</h2>
        <div className="form-row">
          <div>
            <label>Status</label>
            <select value={form.membership_status} onChange={(e) => update("membership_status", e.target.value)}>
              <option>Visitor</option>
              <option>New convert</option>
              <option>Member</option>
              <option>Inactive</option>
            </select>
          </div>
          <div>
            <label>Date joined</label>
            <input type="date" value={form.date_joined} onChange={(e) => update("date_joined", e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Baptism date</label>
            <input type="date" value={form.baptism_date} onChange={(e) => update("baptism_date", e.target.value)} />
          </div>
          <div>
            <label>Occupation</label>
            <input value={form.occupation} onChange={(e) => update("occupation", e.target.value)} />
          </div>
        </div>

        <label>Ministries / departments</label>
        <div className="checkbox-group">
          {ministries.map((m) => (
            <label key={m.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={form.ministry_ids.includes(m.id)}
                onChange={() => toggleMinistry(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>

        <label>Household</label>
        <select value={form.household_id} onChange={(e) => update("household_id", e.target.value)}>
          <option value="">No household</option>
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Or create a new household (e.g. Adams family)"
          value={newHouseholdName}
          onChange={(e) => setNewHouseholdName(e.target.value)}
        />

        <h2>Emergency contact</h2>
        <div className="form-row">
          <div>
            <label>Name</label>
            <input value={form.emergency_contact_name} onChange={(e) => update("emergency_contact_name", e.target.value)} />
          </div>
          <div>
            <label>Phone</label>
            <input value={form.emergency_contact_phone} onChange={(e) => update("emergency_contact_phone", e.target.value)} />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save member"}
        </button>
      </form>
    </div>
  );
}
