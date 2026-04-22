import { test, expect } from "@grafana/plugin-e2e";

test("smoke: panel renders without error", async ({ panelEditPage }) => {
  await panelEditPage.datasource.set("gdev-testdata");
  await panelEditPage.setVisualization("Pyris");
  await expect(panelEditPage.refreshPanel()).toBeOK();
});
