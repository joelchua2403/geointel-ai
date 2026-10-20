
import { useEffect, useMemo, useState } from "react";
import type { StrategicSite } from "../utils/strategicSites";

type Coordinates = {
  lat: number;
  lng: number;
};

type Props = {
  sites: StrategicSite[];
  onChange: (sites: StrategicSite[]) => void;
  onClose: () => void;
  onPickOnMap: () => void;
  pickedCoordinates: Coordinates | null;
  onCoordinatesConsumed: () => void;
};

type SiteForm = {
  name: string;
  category: string;
  description: string;
  lat: string;
  lng: string;
  enabled: boolean;
};

const CATEGORIES = [
  "Military",
  "Maritime",
  "Energy",
  "Infrastructure",
  "Diplomatic",
  "Other",
];

const EMPTY_FORM: SiteForm = {
  name: "",
  category: "Military",
  description: "",
  lat: "",
  lng: "",
  enabled: true,
};

// Preserve an unfinished form while the modal closes
// temporarily for map coordinate picking.
let pendingDraft: {
  editingId: string | null;
  form: SiteForm;
} | null = null;

function formFromSite(site: StrategicSite): SiteForm {
  return {
    name: site.name,
    category: site.category,
    description: site.description,
    lat: String(site.lat),
    lng: String(site.lng),
    enabled: site.enabled,
  };
}

function makeSiteId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `site-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export default function StrategicSitesManager({
  sites,
  onChange,
  onClose,
  onPickOnMap,
  pickedCoordinates,
  onCoordinatesConsumed,
}: Props) {
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(
    () => pendingDraft?.editingId ?? null
  );

  const [form, setForm] = useState<SiteForm>(
    () => pendingDraft?.form ?? { ...EMPTY_FORM }
  );

  const [error, setError] = useState("");

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return sites;

    return sites.filter((site) =>
      [
        site.name,
        site.category,
        site.description,
        String(site.lat),
        String(site.lng),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [sites, search]);

  const enabledCount = sites.filter(
    (site) => site.enabled
  ).length;

  // Apply coordinates returned by the map picker.
  useEffect(() => {
    if (!pickedCoordinates) return;

    setForm((previous) => ({
      ...previous,
      lat: String(pickedCoordinates.lat),
      lng: String(pickedCoordinates.lng),
    }));

    setError("");
    onCoordinatesConsumed();
  }, [pickedCoordinates, onCoordinatesConsumed]);

  // Close with Escape.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        pendingDraft = null;
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [onClose]);

  function updateForm<K extends keyof SiteForm>(
    key: K,
    value: SiteForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    setError("");
  }

  function startNewSite() {
    pendingDraft = null;
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setError("");
  }

  function selectSite(site: StrategicSite) {
    pendingDraft = null;
    setEditingId(site.id);
    setForm(formFromSite(site));
    setError("");
  }

  function handlePickOnMap() {
    pendingDraft = {
      editingId,
      form: { ...form },
    };

    onPickOnMap();
  }

  function handleClose() {
    pendingDraft = null;
    onClose();
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = form.name.trim();
    const category = form.category;
    const description = form.description.trim();

    if (!name) {
      setError("Please enter a site name.");
      return;
    }

    if (!form.lat.trim() || !form.lng.trim()) {
      setError("Please provide latitude and longitude.");
      return;
    }

    const lat = Number(form.lat);
    const lng = Number(form.lng);

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90
    ) {
      setError(
        "Latitude must be a number between -90 and 90."
      );
      return;
    }

    if (
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      setError(
        "Longitude must be a number between -180 and 180."
      );
      return;
    }

    const duplicate = sites.some(
      (site) =>
        site.id !== editingId &&
        site.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setError(
        "A strategic site with this name already exists."
      );
      return;
    }

    if (editingId) {
      onChange(
        sites.map((site) =>
          site.id === editingId
            ? {
                ...site,
                name,
                category,
                description,
                lat,
                lng,
                enabled: form.enabled,
              }
            : site
        )
      );
    } else {
      const newSite: StrategicSite = {
        id: makeSiteId(),
        name,
        category,
        description,
        lat,
        lng,
        enabled: form.enabled,
      };

      onChange([...sites, newSite]);
      setEditingId(newSite.id);
    }

    pendingDraft = null;
    setError("");
  }

  function handleDelete(site: StrategicSite) {
    const confirmed = window.confirm(
      `Delete "${site.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    onChange(
      sites.filter((item) => item.id !== site.id)
    );

    if (editingId === site.id) {
      startNewSite();
    }
  }

  function toggleSite(site: StrategicSite) {
    onChange(
      sites.map((item) =>
        item.id === site.id
          ? { ...item, enabled: !item.enabled }
          : item
      )
    );

    if (editingId === site.id) {
      setForm((previous) => ({
        ...previous,
        enabled: !site.enabled,
      }));
    }
  }

  return (
    <div
      className="sites-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className="sites-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Strategic Sites Manager"
      >
        {/* HEADER */}
        <div className="sites-modal-header">
          <div className="sites-modal-title">
            <div className="sites-modal-icon">
              ◆
            </div>

            <div>
              <h2>STRATEGIC SITES MANAGER</h2>
              <p>
                Manage custom geospatial reference
                locations
              </p>
            </div>
          </div>

          <button
            type="button"
            className="sites-close-button"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* STATISTICS */}
        <div className="sites-toolbar">
          <div className="sites-stat">
            <span className="sites-stat-dot" />
            {sites.length} TOTAL SITES
          </div>

          <span className="sites-stat-separator">
            /
          </span>

          <div className="sites-stat">
            {enabledCount} ACTIVE
          </div>

          <span className="sites-storage-label">
            LOCAL STORAGE
          </span>
        </div>

        {/* MAIN CONTENT */}
        <div className="sites-modal-body">
          {/* LEFT: SITE LIST */}
          <div className="sites-list-panel">
            <div className="sites-section-header">
              <strong>REGISTERED SITES</strong>

              <button
                type="button"
                onClick={startNewSite}
              >
                + NEW SITE
              </button>
            </div>

            <input
              className="sites-search"
              type="search"
              placeholder="Search sites..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <div className="sites-list">
              {filteredSites.length === 0 ? (
                <div className="sites-empty">
                  {sites.length === 0
                    ? "No strategic sites added yet."
                    : "No sites match your search."}
                </div>
              ) : (
                filteredSites.map((site) => (
                  <div
                    key={site.id}
                    className={`sites-list-item ${
                      editingId === site.id
                        ? "is-selected"
                        : ""
                    }`}
                  >
                    <div className="sites-item-top">
                      <span
                        className={`sites-item-indicator ${
                          site.enabled ? "active" : ""
                        }`}
                      />

                      <button
                        type="button"
                        className="sites-item-info"
                        onClick={() =>
                          selectSite(site)
                        }
                      >
                        <strong>
                          {site.name}
                        </strong>

                        <small>
                          {site.category}
                        </small>
                      </button>

                      <span
                        className={`sites-status ${
                          site.enabled
                            ? "enabled"
                            : "disabled"
                        }`}
                      >
                        {site.enabled
                          ? "ACTIVE"
                          : "HIDDEN"}
                      </span>
                    </div>

                    <div className="sites-item-coordinates">
                      {site.lat.toFixed(5)},{" "}
                      {site.lng.toFixed(5)}
                    </div>

                    <div className="sites-item-actions">
                      <button
                        type="button"
                        onClick={() =>
                          selectSite(site)
                        }
                      >
                        EDIT
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleSite(site)
                        }
                      >
                        {site.enabled
                          ? "HIDE"
                          : "SHOW"}
                      </button>

                      <button
                        type="button"
                        className="sites-delete"
                        onClick={() =>
                          handleDelete(site)
                        }
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT: SITE EDITOR */}
          <div className="sites-editor-panel">
            <div className="sites-section-header">
              <strong>
                {editingId
                  ? "EDIT STRATEGIC SITE"
                  : "ADD STRATEGIC SITE"}
              </strong>

              <span>
                {editingId
                  ? "EDIT MODE"
                  : "NEW ENTRY"}
              </span>
            </div>

            <form
              className="sites-form"
              onSubmit={handleSave}
            >
              <label>
                SITE NAME

                <input
                  type="text"
                  placeholder="e.g. Changi Naval Base"
                  value={form.name}
                  onChange={(event) =>
                    updateForm(
                      "name",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                CATEGORY

                <select
                  value={form.category}
                  onChange={(event) =>
                    updateForm(
                      "category",
                      event.target.value
                    )
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                DESCRIPTION

                <textarea
                  placeholder="Site description..."
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    updateForm(
                      "description",
                      event.target.value
                    )
                  }
                />
              </label>

              {/* MAP LOCATION PICKER */}
              <button
                type="button"
                className="sites-pick-button"
                onClick={handlePickOnMap}
              >
                ◎ PICK LOCATION ON MAP
              </button>

              <div className="sites-coordinates">
                <label>
                  LATITUDE

                  <input
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    placeholder="1.3521"
                    value={form.lat}
                    onChange={(event) =>
                      updateForm(
                        "lat",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  LONGITUDE

                  <input
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    placeholder="103.8198"
                    value={form.lng}
                    onChange={(event) =>
                      updateForm(
                        "lng",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <p className="sites-field-hint">
                Enter coordinates manually or click
                Pick Location on Map.
              </p>

              <label className="sites-check">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    updateForm(
                      "enabled",
                      event.target.checked
                    )
                  }
                />

                Display this site on the map
              </label>

              {error && (
                <div
                  className="sites-error"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="sites-form-actions">
                <button
                  type="button"
                  className="sites-reset-button"
                  onClick={startNewSite}
                >
                  CLEAR
                </button>

                <button
                  type="submit"
                  className="sites-save-button"
                >
                  {editingId
                    ? "SAVE CHANGES"
                    : "ADD SITE"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sites-modal-footer">
          <span>
            ◆ CUSTOM STRATEGIC LOCATIONS
          </span>

          <span>
            DATA STORED IN THIS BROWSER
          </span>
        </div>
      </div>
    </div>
  );
}
