"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsShell } from "@/components/settings/settings-shell";
import { updateWorkspace, useWorkspaceSettings } from "@/lib/settings/workspace";
import { slugify } from "@/lib/utils";

export function ProjectsSettingsView() {
  const settings = useWorkspaceSettings();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const activeCount = settings.projects.filter((project) => project.status === "active").length;

  function addProject(event: FormEvent) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    const base = `project-${slugify(nextName) || "project"}`;
    const id = settings.projects.some((project) => project.id === base) ? `${base}-${Date.now()}` : base;
    updateWorkspace({
      projects: [
        ...settings.projects,
        { id, name: nextName, description: description.trim(), status: "active" },
      ],
    });
    setName("");
    setDescription("");
  }

  function toggleArchive(id: string) {
    const project = settings.projects.find((item) => item.id === id);
    if (!project) return;
    if (project.status === "active" && activeCount === 1) return;
    updateWorkspace({
      projects: settings.projects.map((item) =>
        item.id === id ? { ...item, status: item.status === "active" ? "archived" : "active" } : item,
      ),
    });
  }

  return (
    <SettingsShell title="Projects" description="Products in this organization">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Keep one project active. People in the workspace can work in every active project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-border p-0">
            {settings.projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{project.name}</span>
                    <Badge variant={project.status === "active" ? "success" : "muted"}>{project.status}</Badge>
                  </div>
                  {project.description && <p className="mt-0.5 text-xs text-muted-foreground">{project.description}</p>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => toggleArchive(project.id)}>
                  {project.status === "active" ? "Archive" : "Restore"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addProject} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Name</Label>
                <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-description">Description</Label>
                <Input
                  id="project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="h-9"
                />
              </div>
              <Button type="submit" size="sm">
                Add project
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}
