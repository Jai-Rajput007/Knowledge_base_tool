"use client";

import React from "react";
import { FeatureGate } from "@/app/components/feature-gate";
import { useWakeWordState } from "./hooks/useWakeWordState";
import { SystemStatus } from "./components/SystemStatus";
import { TrainForm } from "./components/TrainForm";
import { LiveProgress } from "./components/LiveProgress";
import { JobHistory } from "./components/JobHistory";
import { QuickReference } from "./components/QuickReference";

export function WakeWordSettingsModule() {
  const {
    phrase, setPhrase, quality, setQuality, files, setFiles,
    submitting, submitMsg,
    maintStatus, maintLoading, toggleMaintenance,
    jobs, activeJob, localStatus, backend, agxIp,
    logRef, logs,
    startTraining, deployJob, cancelJob, syncJob,
    fetchJobs, fetchLocalStatus
  } = useWakeWordState();

  return (
    <FeatureGate featureKey="wakeWordSettings">
      <div className="max-w-6xl mx-auto space-y-16 pb-32 pt-8">
        <div className="border-b border-border pb-6">
          <h1 className="text-4xl font-bold tracking-tighter uppercase text-foreground">
            Wake Word
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground mt-2 uppercase tracking-widest">
            SYS.CONFIG // Train and deploy custom wake word models
          </p>
        </div>

        <SystemStatus
          backend={backend}
          agxIp={agxIp}
          maintStatus={maintStatus}
          activeJob={activeJob}
          maintLoading={maintLoading}
          toggleMaintenance={toggleMaintenance}
        />

        <TrainForm
          phrase={phrase}
          setPhrase={setPhrase}
          quality={quality}
          setQuality={setQuality}
          files={files}
          setFiles={setFiles}
          activeJob={activeJob}
          backend={backend}
          maintStatus={maintStatus}
          submitting={submitting}
          submitMsg={submitMsg}
          startTraining={startTraining}
        />

        <LiveProgress
          activeJob={activeJob}
          localStatus={localStatus}
          logs={logs}
          logRef={logRef}
          fetchLocalStatus={fetchLocalStatus}
          cancelJob={cancelJob}
        />

        <JobHistory
          jobs={jobs}
          activeJob={activeJob}
          fetchJobs={fetchJobs}
          deployJob={deployJob}
          syncJob={syncJob}
        />

        <QuickReference />
      </div>
    </FeatureGate>
  );
}
