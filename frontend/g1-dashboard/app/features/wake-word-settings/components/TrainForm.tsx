import React from "react";
import { WakeWordJob } from "../types";
import { qualityInfo } from "../helpers";

interface TrainFormProps {
  phrase: string;
  setPhrase: (val: string) => void;
  quality: "draft" | "standard" | "production";
  setQuality: (val: "draft" | "standard" | "production") => void;
  files: File[];
  setFiles: (files: File[]) => void;
  activeJob: WakeWordJob | null;
  backend: string;
  maintStatus: { maintenance_mode: boolean; pipeline_running: boolean } | null;
  submitting: boolean;
  submitMsg: string;
  startTraining: () => void;
}

export function TrainForm({
  phrase, setPhrase, quality, setQuality, files, setFiles,
  activeJob, backend, maintStatus, submitting, submitMsg, startTraining
}: TrainFormProps) {
  return (
    <section id="train" className="border-t border-border pt-8 scroll-mt-28">
      <div className="flex items-center gap-4 mb-8">
        <span className="text-primary font-mono text-sm">[02]</span>
        <h2 className="text-xl font-bold uppercase tracking-wide text-foreground">train new wake word</h2>
      </div>

      <div className="border border-border bg-card/50 p-6 space-y-6">
        <p className="text-xs font-mono text-muted-foreground uppercase">// training configuration</p>

        <div>
          <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-2">
            Wake Phrase
          </label>
          <input
            type="text"
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            placeholder="e.g. hey jai"
            disabled={!!activeJob}
            className="w-full bg-background border border-border px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary disabled:opacity-40 uppercase"
          />
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            2-3 words work best. Avoid common phrases.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-3">
            Training Quality
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(["draft", "standard", "production"] as const).map(q => {
              const info = qualityInfo[q];
              const time = backend === "local_agx" ? 
                (q === "draft" ? "2-3 hrs" : q === "standard" ? "4-6 hrs" : "8-12 hrs") : 
                (q === "draft" ? "1.5 hrs" : q === "standard" ? "2.5 hrs" : "4.5 hrs");
              return (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  disabled={!!activeJob}
                  className={`border p-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                    ${quality === q
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <p className="font-mono text-xs font-bold uppercase">{info.label}</p>
                  <p className="font-mono text-[10px] mt-2 opacity-70">{info.steps} steps</p>
                  <p className="font-mono text-[10px] opacity-70">{info.samples} clips</p>
                  <p className="font-mono text-[10px] mt-1 text-primary/70">~{time}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-muted-foreground uppercase mb-2">
            Audio Samples (optional but recommended)
          </label>
          <div className="border border-dashed border-border/50 p-6 text-center">
            <input
              type="file"
              accept=".wav,.mp3,.m4a"
              multiple
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
              disabled={!!activeJob}
              className="hidden"
              id="sample-upload"
            />
            <label htmlFor="sample-upload" className={`cursor-pointer ${activeJob ? "opacity-40 cursor-not-allowed" : ""}`}>
              <p className="font-mono text-xs text-muted-foreground uppercase">
                {files.length > 0
                  ? `${files.length} file(s) selected`
                  : "[ DROP WAV FILES OR CLICK TO UPLOAD ]"
                }
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/50 mt-2">
                50+ recordings = better Indian accent accuracy (85-95% recall)
              </p>
            </label>
          </div>
          {files.length > 0 && (
            <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
              {files.map((f, i) => (
                <p key={i} className="font-mono text-[10px] text-muted-foreground">
                  ▸ {f.name} ({(f.size / 1024).toFixed(0)} KB)
                </p>
              ))}
            </div>
          )}
        </div>

        {backend === "local_agx" && !maintStatus?.maintenance_mode && (
          <div className="border border-yellow-400/30 bg-yellow-400/5 p-3">
            <p className="font-mono text-[10px] text-yellow-400 uppercase">
              ⚠ Robot not in maintenance mode — enable it above before training
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            onClick={startTraining}
            disabled={submitting || !!activeJob || (backend === "local_agx" && !maintStatus?.maintenance_mode)}
            className="px-6 py-3 border border-primary text-primary font-mono text-xs uppercase hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "[ STARTING... ]" : "[ START TRAINING ]"}
          </button>
          {activeJob && (
            <p className="font-mono text-[10px] text-yellow-400 uppercase">
              Job #{activeJob.id} already running — wait or cancel it
            </p>
          )}
        </div>

        {submitMsg && (
          <p className={`font-mono text-xs uppercase ${submitMsg.includes("failed") || submitMsg.includes("Enter") ? "text-red-400" : "text-green-400"}`}>
            {submitMsg}
          </p>
        )}
      </div>
    </section>
  );
}
