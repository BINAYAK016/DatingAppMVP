const key = document.getElementById("key"),
  status = document.getElementById("status"),
  cases = document.getElementById("cases");
async function request(path, body) {
  const response = await fetch("/v1/admin/" + path, {
    method: body ? "POST" : "GET",
    headers: { "x-admin-key": key.value, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.message);
  return data;
}
async function load() {
  try {
    const data = await request("reports");
    cases.replaceChildren();
    status.textContent = data.length + " reports";
    for (const report of data) {
      const card = document.createElement("article");
      const heading = document.createElement("h2");
      heading.textContent =
        (report.target_name || "Deleted account") + " · " + report.state;
      const description = document.createElement("p");
      description.textContent = report.reason;
      const context = document.createElement("p");
      context.textContent = report.context;
      const resolution = document.createElement("textarea");
      resolution.placeholder = "Explain the resolution shown to the reporter";
      card.append(heading, description, context, resolution);
      const row = document.createElement("div");
      row.className = "row";
      for (const action of ["resolve", "dismiss", "suspend"]) {
        const button = document.createElement("button");
        button.textContent = action;
        button.onclick = async () => {
          try {
            await request("reports/" + report.id, {
              action,
              resolution: resolution.value,
            });
            await load();
          } catch (e) {
            status.textContent = e.message;
          }
        };
        row.append(button);
      }
      card.append(row);
      cases.append(card);
    }
  } catch (e) {
    status.textContent = e.message;
  }
}
document.getElementById("load").onclick = load;
