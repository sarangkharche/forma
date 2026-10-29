"use client";

import { MorphIcon, type IconInput, type MorphIconProps } from "morphicons/react";
import {
  FileText as FileTextData,
  Download as DownloadData, CircleCheck as CircleCheckData, CircleX as CircleXData, Info as InfoData, TriangleAlert as TriangleAlertData,
  Copy as CopyData, Pencil as PencilData, Eye as EyeData, Archive as ArchiveData, ArchiveRestore as ArchiveRestoreData,
  Bell as BellData, ArrowUpRight as ArrowUpRightData, Check as CheckData, CheckCheck as CheckCheckData,
  ChevronRight as ChevronRightData, ChevronDown as ChevronDownData, ChevronUp as ChevronUpData,
  Circle as CircleData, Clock3 as ClockData, Folder as FolderData, Inbox as InboxData,
  Layers2 as LayersData, Moon as MoonData, Plus as PlusData, RefreshCw as RefreshData,
  Search as SearchData, Sparkles as SparklesData, Sun as SunData, X as CloseData,
} from "lucide";

function iconComponent(name: string, icon: IconInput) {
  function Icon({ size = name.startsWith("Chevron") ? 12 : 16, strokeWidth = 1.5, ...props }: MorphIconProps) {
    return <MorphIcon {...props} icon={icon} size={size} strokeWidth={strokeWidth} absoluteStrokeWidth strokeLinecap="butt" spring="snappy" reducedMotion="user" />;
  }
  Icon.displayName = name;
  return Icon;
}

export const ArrowUpRight = iconComponent("ArrowUpRight", ArrowUpRightData);
export const Check = iconComponent("Check", CheckData);
export const FileText = iconComponent("FileText", FileTextData);
export const CheckCheck = iconComponent("CheckCheck", CheckCheckData);
export const ChevronRight = iconComponent("ChevronRight", ChevronRightData);
export const ChevronDown = iconComponent("ChevronDown", ChevronDownData);
export const ChevronUp = iconComponent("ChevronUp", ChevronUpData);
export const Circle = iconComponent("Circle", CircleData);
export const Clock3 = iconComponent("Clock3", ClockData);
export const Folder = iconComponent("Folder", FolderData);
export const Inbox = iconComponent("Inbox", InboxData);
export const Layers2 = iconComponent("Layers2", LayersData);
export const Moon = iconComponent("Moon", MoonData);
export const Plus = iconComponent("Plus", PlusData);
export const RefreshCw = iconComponent("RefreshCw", RefreshData);
export const Search = iconComponent("Search", SearchData);
export const Sparkles = iconComponent("Sparkles", SparklesData);
export const Sun = iconComponent("Sun", SunData);
export const X = iconComponent("X", CloseData);

export function ThemeIcon({ dark }: { dark: boolean }) {
  return <MorphIcon icon={dark ? SunData : MoonData} size={16} strokeWidth={1.5} absoluteStrokeWidth strokeLinecap="butt" spring="snappy" reducedMotion="user" />;
}

export const Bell = iconComponent("Bell", BellData);

export const CircleCheck = iconComponent("CircleCheck", CircleCheckData);
export const CircleX = iconComponent("CircleX", CircleXData);
export const Info = iconComponent("Info", InfoData);
export const TriangleAlert = iconComponent("TriangleAlert", TriangleAlertData);

export const Copy = iconComponent("Copy", CopyData);

export const Pencil = iconComponent("Pencil", PencilData);

export const Eye = iconComponent("Eye", EyeData);

export const Archive = iconComponent("Archive", ArchiveData);

export const ArchiveRestore = iconComponent("ArchiveRestore", ArchiveRestoreData);

export const Download = iconComponent("Download", DownloadData);
