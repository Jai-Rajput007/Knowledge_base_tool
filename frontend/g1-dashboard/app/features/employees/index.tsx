"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { FeatureGate } from "@/app/components/feature-gate";

interface Employee {
  id: number;
  employee_id: string;
  username: string;
  email: string;
  department: string | null;
  face_id: string | null;
  photo_count: number;
  is_enrolled: boolean;
  is_active: number;
  created_at: string;
}

function PhotoBadge({ count }: { count: number }) {
  if (count === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
      ✗ No photo
    </span>
  );
  if (count === 1) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      ⚠ {count} photo
    </span>
  );
  if (count < 3) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      {count} photos
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
      ✓ {count} photos
    </span>
  );
}

export function EmployeesModule() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [bulkResult, setBulkResult] = useState<any>(null);

  // Add photos modal
  const [photoTarget, setPhotoTarget] = useState<Employee | null>(null);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const bulkRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await api.listEmployees();
    if (res.data) {
      setEmployees(res.data);
    } else if (res.error) {
      const errStr = typeof res.error === "string" ? res.error : "";
      if (errStr.includes("401") || errStr.toLowerCase().includes("unauthorized") || errStr.toLowerCase().includes("not authenticated")) {
        api.removeToken();
        router.push("/auth/login");
        return;
      }
      setError("Failed to load employees: " + errStr);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const photos = (e.currentTarget.querySelector("#photos") as HTMLInputElement)?.files;
    if (!photos || photos.length === 0) {
      setError("At least one photo is required.");
      setSubmitting(false);
      return;
    }
    const res = await api.createEmployee(fd);
    setSubmitting(false);
    if (res.error) {
      setError(typeof res.error === "string" ? res.error : JSON.stringify(res.error));
    } else {
      setSuccess("Employee enrolled successfully.");
      setShowForm(false);
      formRef.current?.reset();
      load();
    }
  };

  const handleBulk = async () => {
    if (!bulkRef.current?.files?.[0]) return;
    setSubmitting(true);
    setBulkResult(null);
    setError("");
    const fd = new FormData();
    fd.append("file", bulkRef.current.files[0]);
    const res = await api.bulkImportEmployees(fd);
    setSubmitting(false);
    if (res.error) {
      setError(typeof res.error === "string" ? res.error : JSON.stringify(res.error));
    } else {
      setBulkResult(res.data);
      setShowBulk(false);
      load();
    }
  };

  const handleAddPhotos = async () => {
    if (!photoTarget || !photoFiles || photoFiles.length === 0) return;
    setSubmitting(true);
    const fd = new FormData();
    Array.from(photoFiles).forEach(f => fd.append("photos", f));
    const res = await api.addEmployeePhotos(photoTarget.employee_id, fd);
    setSubmitting(false);
    if (res.error) {
      setError(typeof res.error === "string" ? res.error : JSON.stringify(res.error));
    } else {
      setSuccess("Photos added successfully.");
      setPhotoTarget(null);
      setPhotoFiles(null);
      load();
    }
  };

  const handleDelete = async (emp: Employee) => {
    if (!confirm(`Delete employee ${emp.username} (${emp.employee_id})?`)) return;
    await api.deleteEmployee(emp.employee_id);
    load();
  };

  return (
    <FeatureGate featureKey="frs">
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
        {/* Header */}
        <div className="border-b border-border pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">Employees</h1>
            <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">Manage employee face enrollment for robot recognition</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowBulk(true); setError(""); setBulkResult(null); }}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
              Bulk Import (Excel)
            </button>
            <button onClick={() => { setShowForm(true); setError(""); setSuccess(""); }}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              + Add Employee
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">{success}</div>}
        {bulkResult && (
          <div className="mb-4 p-4 rounded-lg bg-card border border-border text-sm space-y-1">
            <p className="font-medium">Bulk import complete: {bulkResult.enrolled} enrolled, {bulkResult.failed} failed (total {bulkResult.total})</p>
            {bulkResult.errors?.length > 0 && (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {bulkResult.errors.map((e: any, i: number) => (
                  <li key={i} className="text-red-400">Row {e.row} ({e.employee_id}): {e.reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Employee ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Face Enrolled</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Photos</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No employees enrolled yet.</td></tr>
              ) : employees.map(emp => (
                <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.employee_id}</td>
                  <td className="px-4 py-3 font-medium">{emp.username.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.department || "—"}</td>
                  <td className="px-4 py-3">
                    {emp.is_enrolled
                      ? <span className="text-green-400 text-xs">✓ Enrolled</span>
                      : <span className="text-red-400 text-xs">✗ Not enrolled</span>}
                  </td>
                  <td className="px-4 py-3"><PhotoBadge count={emp.photo_count} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => { setPhotoTarget(emp); setError(""); }}
                        className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors">
                        + Photos
                      </button>
                      <button onClick={() => handleDelete(emp)}
                        className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Employee</h2>
            <form ref={formRef} onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Employee ID *</label>
                  <input name="employee_id" required placeholder="EMP001"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name *</label>
                  <input name="name" required placeholder="Jai"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email <span className="text-muted-foreground/60">(optional)</span></label>
                  <input name="email" type="email" placeholder="Jai@company.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Department <span className="text-muted-foreground/60">(optional)</span></label>
                  <input name="department" placeholder="Management"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Photos * (select multiple for better accuracy)</label>
                <input id="photos" name="photos" type="file" multiple accept="image/*" required
                  className="w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground cursor-pointer" />
                <p className="text-xs text-yellow-500 mt-1">
                  💡 Add 3+ photos from different angles for best accuracy
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {submitting ? "Enrolling..." : "Enroll"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-2">Bulk Import (Excel)</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload an <strong>.xlsx</strong> file with columns:<br />
              <code className="text-xs bg-muted px-1 py-0.5 rounded">employee_id | name | email (optional) | department (optional)</code><br />
              Insert one photo per row (any column — matched by row number).
            </p>
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs mb-4">
              ⚠ Photo is required for each row. Rows without a photo will be skipped.
            </div>
            <input ref={bulkRef} type="file" accept=".xlsx,.xls"
              className="w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground cursor-pointer mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowBulk(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleBulk} disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {submitting ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Photos Modal */}
      {photoTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-1">Add Photos</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {photoTarget.username.replace(/_/g, " ")} — currently {photoTarget.photo_count} photo(s)
            </p>
            <input type="file" multiple accept="image/*"
              onChange={e => setPhotoFiles(e.target.files)}
              className="w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground cursor-pointer mb-2" />
            <p className="text-xs text-muted-foreground mb-4">
              Use photos from different angles (front, left, right) for best accuracy.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPhotoTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={handleAddPhotos} disabled={submitting || !photoFiles}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {submitting ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeatureGate>
  );
}
