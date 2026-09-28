/* ============================================================
   TMB STUDIO — site-data.js
   Public, read-only Supabase access for the Projects section and
   the Team section: fetches published projects, team members, and
   populates the nav dropdown. The Home page's video/about-images
   still come from cms.js + content.json.
   ============================================================ */

const SUPABASE_URL = "https://rmfyfinfiujiqwljuxld.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtZnlmaW5maXVqaXF3bGp1eGxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NTcwMTgsImV4cCI6MjEwMjMzMzAxOH0.aJVN9JwpiJLA1Q-x_r9hfmAl7KRwTv97MHsJuWh-td8";

const TMB_DATA = (() => {
  let client = null;
  if (window.supabase) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn("TMB_DATA: supabase-js didn't load — check the CDN script tag.");
  }

  async function fetchProjects() {
    if (!client) return [];
    const { data, error } = await client
      .from("projects")
      .select("*")
      .eq("published", true)
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("TMB_DATA: could not load projects", error);
      return [];
    }
    return data;
  }

  async function fetchProjectBySlug(slug) {
    if (!client) return null;
    const { data, error } = await client.from("projects").select("*").eq("slug", slug).single();
    if (error) {
      console.warn("TMB_DATA: could not load project", slug, error);
      return null;
    }
    return data;
  }

  function populateNavDropdowns(projects) {
    document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
      dropdown.innerHTML = "";
      projects.forEach((p) => {
        const a = document.createElement("a");
        a.href = `./project.html?slug=${encodeURIComponent(p.slug)}`;
        a.textContent = p.title;
        dropdown.appendChild(a);
      });
    });
  }

  async function fetchTeamMembers() {
    if (!client) return [];
    const { data, error } = await client
      .from("team_members")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("TMB_DATA: could not load team members", error);
      return [];
    }
    return data;
  }

  function statusLabel(project) {
    const map = {
      in_development: "● In Development",
      published: "● Published",
      cancelled: "● Cancelled",
    };
    const base = map[project.status] || project.status;
    return project.status_note ? `${base} — ${project.status_note}` : base;
  }

  function statusClass(project) {
    return `status-${(project.status || "").replace(/_/g, "-")}`;
  }

  return { client, fetchProjects, fetchProjectBySlug, fetchTeamMembers, populateNavDropdowns, statusLabel, statusClass };
})();

window.TMB_DATA = TMB_DATA;
