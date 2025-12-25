/**
 * Meta-Analysis Integration Service
 * Provides effect size calculations and forest plot data
 */

// ============== TYPES ==============

export interface StudyEffect {
  studyId: string;
  studyName: string;
  year?: number;
  
  // For continuous outcomes
  meanTreatment?: number;
  sdTreatment?: number;
  nTreatment?: number;
  meanControl?: number;
  sdControl?: number;
  nControl?: number;
  
  // For binary outcomes
  eventsTreatment?: number;
  totalTreatment?: number;
  eventsControl?: number;
  totalControl?: number;
  
  // Pre-calculated effect
  effectSize?: number;
  standardError?: number;
  variance?: number;
  ciLower?: number;
  ciUpper?: number;
  weight?: number;
}

export interface MetaAnalysisResult {
  // Summary effect
  pooledEffect: number;
  pooledSE: number;
  pooledCI: { lower: number; upper: number };
  pValue: number;
  
  // Heterogeneity
  Q: number;
  df: number;
  pHeterogeneity: number;
  I2: number;
  tau2?: number; // For random effects
  
  // Studies
  studyEffects: StudyEffectWithWeight[];
  
  // Model info
  model: "fixed" | "random";
  effectMeasure: EffectMeasure;
}

export interface StudyEffectWithWeight extends StudyEffect {
  effectSize: number;
  variance: number;
  weight: number;
  ciLower: number;
  ciUpper: number;
}

export type EffectMeasure = 
  | "RR"   // Risk Ratio
  | "OR"   // Odds Ratio
  | "HR"   // Hazard Ratio
  | "RD"   // Risk Difference
  | "MD"   // Mean Difference
  | "SMD"; // Standardized Mean Difference

export interface ForestPlotData {
  studies: ForestPlotStudy[];
  summary: {
    effect: number;
    ciLower: number;
    ciUpper: number;
    label: string;
  };
  scale: {
    min: number;
    max: number;
    nullEffect: number;
  };
  heterogeneity: {
    I2: number;
    Q: number;
    pValue: number;
  };
  model: "fixed" | "random";
  effectMeasure: EffectMeasure;
}

export interface ForestPlotStudy {
  id: string;
  name: string;
  year?: number;
  effect: number;
  ciLower: number;
  ciUpper: number;
  weight: number;
  weightPercent: number;
}

// ============== EFFECT SIZE CALCULATIONS ==============

/**
 * Calculate Risk Ratio (RR)
 */
export function calculateRiskRatio(
  eventsTreatment: number,
  totalTreatment: number,
  eventsControl: number,
  totalControl: number
): { effect: number; se: number; variance: number } {
  const p1 = eventsTreatment / totalTreatment;
  const p2 = eventsControl / totalControl;
  
  // Log RR
  const logRR = Math.log(p1 / p2);
  
  // Variance of log RR
  const variance = (1 / eventsTreatment) - (1 / totalTreatment) + 
                   (1 / eventsControl) - (1 / totalControl);
  
  return {
    effect: logRR,
    se: Math.sqrt(variance),
    variance,
  };
}

/**
 * Calculate Odds Ratio (OR)
 */
export function calculateOddsRatio(
  eventsTreatment: number,
  totalTreatment: number,
  eventsControl: number,
  totalControl: number
): { effect: number; se: number; variance: number } {
  const a = eventsTreatment;
  const b = totalTreatment - eventsTreatment;
  const c = eventsControl;
  const d = totalControl - eventsControl;
  
  // Log OR
  const logOR = Math.log((a * d) / (b * c));
  
  // Variance of log OR
  const variance = (1 / a) + (1 / b) + (1 / c) + (1 / d);
  
  return {
    effect: logOR,
    se: Math.sqrt(variance),
    variance,
  };
}

/**
 * Calculate Mean Difference (MD)
 */
export function calculateMeanDifference(
  meanTreatment: number,
  sdTreatment: number,
  nTreatment: number,
  meanControl: number,
  sdControl: number,
  nControl: number
): { effect: number; se: number; variance: number } {
  const md = meanTreatment - meanControl;
  
  // Pooled variance
  const variance = (sdTreatment ** 2 / nTreatment) + (sdControl ** 2 / nControl);
  
  return {
    effect: md,
    se: Math.sqrt(variance),
    variance,
  };
}

/**
 * Calculate Standardized Mean Difference (Hedges' g)
 */
export function calculateSMD(
  meanTreatment: number,
  sdTreatment: number,
  nTreatment: number,
  meanControl: number,
  sdControl: number,
  nControl: number
): { effect: number; se: number; variance: number } {
  const n1 = nTreatment;
  const n2 = nControl;
  
  // Pooled SD
  const pooledSD = Math.sqrt(
    ((n1 - 1) * sdTreatment ** 2 + (n2 - 1) * sdControl ** 2) / (n1 + n2 - 2)
  );
  
  // Cohen's d
  const d = (meanTreatment - meanControl) / pooledSD;
  
  // Hedges' g correction factor
  const J = 1 - (3 / (4 * (n1 + n2 - 2) - 1));
  const g = d * J;
  
  // Variance of g
  const variance = ((n1 + n2) / (n1 * n2)) + (g ** 2 / (2 * (n1 + n2)));
  
  return {
    effect: g,
    se: Math.sqrt(variance),
    variance,
  };
}

// ============== META-ANALYSIS ==============

/**
 * Run fixed-effects meta-analysis
 */
export function fixedEffectsMeta(
  studies: StudyEffect[],
  effectMeasure: EffectMeasure
): MetaAnalysisResult {
  // Calculate effect sizes if not provided
  const processed = studies.map((s) => processStudyEffect(s, effectMeasure));
  
  // Calculate weights (inverse variance)
  const totalWeight = processed.reduce((sum, s) => sum + (1 / s.variance), 0);
  
  const withWeights = processed.map((s) => ({
    ...s,
    weight: (1 / s.variance) / totalWeight,
  }));
  
  // Pooled effect
  const pooledEffect = withWeights.reduce(
    (sum, s) => sum + s.effectSize * s.weight,
    0
  );
  
  // Pooled variance
  const pooledVariance = 1 / processed.reduce((sum, s) => sum + (1 / s.variance), 0);
  const pooledSE = Math.sqrt(pooledVariance);
  
  // Confidence interval
  const z = 1.96; // 95% CI
  const ciLower = pooledEffect - z * pooledSE;
  const ciUpper = pooledEffect + z * pooledSE;
  
  // P-value
  const zStat = Math.abs(pooledEffect / pooledSE);
  const pValue = 2 * (1 - normalCDF(zStat));
  
  // Heterogeneity
  const Q = processed.reduce(
    (sum, s) => sum + (1 / s.variance) * (s.effectSize - pooledEffect) ** 2,
    0
  );
  const df = studies.length - 1;
  const pHeterogeneity = 1 - chiSquareCDF(Q, df);
  const I2 = Math.max(0, ((Q - df) / Q) * 100);
  
  return {
    pooledEffect: transformEffect(pooledEffect, effectMeasure),
    pooledSE,
    pooledCI: {
      lower: transformEffect(ciLower, effectMeasure),
      upper: transformEffect(ciUpper, effectMeasure),
    },
    pValue,
    Q,
    df,
    pHeterogeneity,
    I2,
    studyEffects: withWeights.map((s) => ({
      ...s,
      effectSize: transformEffect(s.effectSize, effectMeasure),
      ciLower: transformEffect(s.effectSize - 1.96 * Math.sqrt(s.variance), effectMeasure),
      ciUpper: transformEffect(s.effectSize + 1.96 * Math.sqrt(s.variance), effectMeasure),
    })),
    model: "fixed",
    effectMeasure,
  };
}

/**
 * Run random-effects meta-analysis (DerSimonian-Laird)
 */
export function randomEffectsMeta(
  studies: StudyEffect[],
  effectMeasure: EffectMeasure
): MetaAnalysisResult {
  // First run fixed effects to get Q
  const fixed = fixedEffectsMeta(studies, effectMeasure);
  const processed = studies.map((s) => processStudyEffect(s, effectMeasure));
  
  // Calculate tau^2 (between-study variance)
  const k = studies.length;
  const sumWeights = processed.reduce((sum, s) => sum + (1 / s.variance), 0);
  const sumWeightsSquared = processed.reduce((sum, s) => sum + (1 / s.variance) ** 2, 0);
  const C = sumWeights - (sumWeightsSquared / sumWeights);
  
  const tau2 = Math.max(0, (fixed.Q - fixed.df) / C);
  
  // New weights with tau^2
  const withWeights = processed.map((s) => ({
    ...s,
    variance: s.variance + tau2,
    weight: 1 / (s.variance + tau2),
  }));
  
  const totalWeight = withWeights.reduce((sum, s) => sum + s.weight, 0);
  const normalizedWeights = withWeights.map((s) => ({
    ...s,
    weight: s.weight / totalWeight,
  }));
  
  // Pooled effect
  const pooledEffect = normalizedWeights.reduce(
    (sum, s) => sum + s.effectSize * s.weight,
    0
  );
  
  // Pooled SE
  const pooledVariance = 1 / withWeights.reduce((sum, s) => sum + s.weight, 0);
  const pooledSE = Math.sqrt(pooledVariance);
  
  // CI and p-value
  const z = 1.96;
  const ciLower = pooledEffect - z * pooledSE;
  const ciUpper = pooledEffect + z * pooledSE;
  const zStat = Math.abs(pooledEffect / pooledSE);
  const pValue = 2 * (1 - normalCDF(zStat));
  
  return {
    pooledEffect: transformEffect(pooledEffect, effectMeasure),
    pooledSE,
    pooledCI: {
      lower: transformEffect(ciLower, effectMeasure),
      upper: transformEffect(ciUpper, effectMeasure),
    },
    pValue,
    Q: fixed.Q,
    df: fixed.df,
    pHeterogeneity: fixed.pHeterogeneity,
    I2: fixed.I2,
    tau2,
    studyEffects: normalizedWeights.map((s) => ({
      ...s,
      effectSize: transformEffect(s.effectSize, effectMeasure),
      ciLower: transformEffect(s.effectSize - 1.96 * Math.sqrt(s.variance), effectMeasure),
      ciUpper: transformEffect(s.effectSize + 1.96 * Math.sqrt(s.variance), effectMeasure),
    })),
    model: "random",
    effectMeasure,
  };
}

// ============== FOREST PLOT ==============

/**
 * Generate forest plot data
 */
export function generateForestPlot(result: MetaAnalysisResult): ForestPlotData {
  const totalWeight = result.studyEffects.reduce((sum, s) => sum + s.weight, 0);
  
  const studies: ForestPlotStudy[] = result.studyEffects.map((s) => ({
    id: s.studyId,
    name: s.studyName,
    year: s.year,
    effect: s.effectSize,
    ciLower: s.ciLower,
    ciUpper: s.ciUpper,
    weight: s.weight,
    weightPercent: (s.weight / totalWeight) * 100,
  }));
  
  // Calculate scale
  const allEffects = [
    ...studies.map((s) => s.ciLower),
    ...studies.map((s) => s.ciUpper),
    result.pooledCI.lower,
    result.pooledCI.upper,
  ];
  
  const min = Math.min(...allEffects);
  const max = Math.max(...allEffects);
  const range = max - min;
  
  // Null effect depends on measure type
  const nullEffect = ["RR", "OR", "HR"].includes(result.effectMeasure) ? 1 : 0;
  
  return {
    studies,
    summary: {
      effect: result.pooledEffect,
      ciLower: result.pooledCI.lower,
      ciUpper: result.pooledCI.upper,
      label: `Overall (${result.model === "fixed" ? "Fixed" : "Random"} effects)`,
    },
    scale: {
      min: min - range * 0.1,
      max: max + range * 0.1,
      nullEffect,
    },
    heterogeneity: {
      I2: result.I2,
      Q: result.Q,
      pValue: result.pHeterogeneity,
    },
    model: result.model,
    effectMeasure: result.effectMeasure,
  };
}

/**
 * Generate forest plot as SVG
 */
export function generateForestPlotSVG(data: ForestPlotData): string {
  const width = 800;
  const rowHeight = 30;
  const headerHeight = 60;
  const footerHeight = 100;
  const leftMargin = 250;
  const rightMargin = 150;
  const plotWidth = width - leftMargin - rightMargin;
  
  const height = headerHeight + (data.studies.length + 1) * rowHeight + footerHeight;
  
  // Scale function
  const xScale = (value: number) => {
    const range = data.scale.max - data.scale.min;
    return leftMargin + ((value - data.scale.min) / range) * plotWidth;
  };
  
  // Study rows
  const studyRows = data.studies.map((s, i) => {
    const y = headerHeight + i * rowHeight + rowHeight / 2;
    const x = xScale(s.effect);
    const ciLeft = xScale(s.ciLower);
    const ciRight = xScale(s.ciUpper);
    const squareSize = Math.sqrt(s.weightPercent) * 3;
    
    return `
      <g>
        <!-- Study name -->
        <text x="10" y="${y + 5}" font-size="11">${s.name}${s.year ? ` (${s.year})` : ""}</text>
        
        <!-- CI line -->
        <line x1="${ciLeft}" y1="${y}" x2="${ciRight}" y2="${y}" stroke="#333" stroke-width="1"/>
        
        <!-- CI caps -->
        <line x1="${ciLeft}" y1="${y - 4}" x2="${ciLeft}" y2="${y + 4}" stroke="#333" stroke-width="1"/>
        <line x1="${ciRight}" y1="${y - 4}" x2="${ciRight}" y2="${y + 4}" stroke="#333" stroke-width="1"/>
        
        <!-- Effect square -->
        <rect x="${x - squareSize / 2}" y="${y - squareSize / 2}" width="${squareSize}" height="${squareSize}" fill="#2563eb"/>
        
        <!-- Effect text -->
        <text x="${width - rightMargin + 10}" y="${y + 5}" font-size="10">
          ${s.effect.toFixed(2)} [${s.ciLower.toFixed(2)}, ${s.ciUpper.toFixed(2)}]
        </text>
        
        <!-- Weight -->
        <text x="${width - 30}" y="${y + 5}" font-size="10" text-anchor="end">${s.weightPercent.toFixed(1)}%</text>
      </g>
    `;
  }).join("");
  
  // Summary row
  const summaryY = headerHeight + data.studies.length * rowHeight + rowHeight / 2;
  const summaryX = xScale(data.summary.effect);
  const summaryCILeft = xScale(data.summary.ciLower);
  const summaryCIRight = xScale(data.summary.ciUpper);
  
  const summaryRow = `
    <g>
      <text x="10" y="${summaryY + 5}" font-size="11" font-weight="bold">${data.summary.label}</text>
      
      <!-- Diamond -->
      <polygon points="${summaryCILeft},${summaryY} ${summaryX},${summaryY - 8} ${summaryCIRight},${summaryY} ${summaryX},${summaryY + 8}" fill="#2563eb"/>
      
      <text x="${width - rightMargin + 10}" y="${summaryY + 5}" font-size="10" font-weight="bold">
        ${data.summary.effect.toFixed(2)} [${data.summary.ciLower.toFixed(2)}, ${data.summary.ciUpper.toFixed(2)}]
      </text>
    </g>
  `;
  
  // Null effect line
  const nullX = xScale(data.scale.nullEffect);
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Header -->
  <text x="10" y="20" font-size="12" font-weight="bold">Study</text>
  <text x="${leftMargin + plotWidth / 2}" y="20" text-anchor="middle" font-size="12" font-weight="bold">
    ${data.effectMeasure} (95% CI)
  </text>
  <text x="${width - rightMargin + 10}" y="20" font-size="12" font-weight="bold">Effect [95% CI]</text>
  <text x="${width - 30}" y="20" font-size="12" font-weight="bold" text-anchor="end">Weight</text>
  
  <!-- Separator line -->
  <line x1="0" y1="35" x2="${width}" y2="35" stroke="#ccc" stroke-width="1"/>
  
  <!-- Null effect line -->
  <line x1="${nullX}" y1="40" x2="${nullX}" y2="${height - footerHeight + 20}" stroke="#666" stroke-width="1" stroke-dasharray="4"/>
  
  <!-- Studies -->
  ${studyRows}
  
  <!-- Separator before summary -->
  <line x1="0" y1="${summaryY - 15}" x2="${width}" y2="${summaryY - 15}" stroke="#ccc" stroke-width="1"/>
  
  <!-- Summary -->
  ${summaryRow}
  
  <!-- Heterogeneity stats -->
  <text x="10" y="${height - 50}" font-size="10">
    Heterogeneity: I² = ${data.heterogeneity.I2.toFixed(1)}%, Q = ${data.heterogeneity.Q.toFixed(2)}, p = ${data.heterogeneity.pValue.toFixed(3)}
  </text>
  
  <!-- Scale labels -->
  <text x="${xScale(data.scale.nullEffect)}" y="${height - 20}" text-anchor="middle" font-size="10">
    ${data.scale.nullEffect === 1 ? "No effect (1)" : "No effect (0)"}
  </text>
  <text x="${leftMargin}" y="${height - 20}" font-size="10">Favors control</text>
  <text x="${leftMargin + plotWidth}" y="${height - 20}" text-anchor="end" font-size="10">Favors treatment</text>
</svg>`;
}

// ============== HELPERS ==============

function processStudyEffect(study: StudyEffect, measure: EffectMeasure): StudyEffectWithWeight {
  let result: { effect: number; se: number; variance: number };
  
  if (study.effectSize !== undefined && study.variance !== undefined) {
    // Use pre-calculated values
    result = {
      effect: study.effectSize,
      se: study.standardError || Math.sqrt(study.variance),
      variance: study.variance,
    };
  } else if (study.eventsTreatment !== undefined) {
    // Binary outcome
    switch (measure) {
      case "RR":
        result = calculateRiskRatio(
          study.eventsTreatment!, study.totalTreatment!,
          study.eventsControl!, study.totalControl!
        );
        break;
      case "OR":
        result = calculateOddsRatio(
          study.eventsTreatment!, study.totalTreatment!,
          study.eventsControl!, study.totalControl!
        );
        break;
      default:
        throw new Error(`Unsupported measure for binary data: ${measure}`);
    }
  } else if (study.meanTreatment !== undefined) {
    // Continuous outcome
    switch (measure) {
      case "MD":
        result = calculateMeanDifference(
          study.meanTreatment!, study.sdTreatment!, study.nTreatment!,
          study.meanControl!, study.sdControl!, study.nControl!
        );
        break;
      case "SMD":
        result = calculateSMD(
          study.meanTreatment!, study.sdTreatment!, study.nTreatment!,
          study.meanControl!, study.sdControl!, study.nControl!
        );
        break;
      default:
        throw new Error(`Unsupported measure for continuous data: ${measure}`);
    }
  } else {
    throw new Error("Insufficient data to calculate effect size");
  }
  
  return {
    ...study,
    effectSize: result.effect,
    variance: result.variance,
    weight: 0, // Will be calculated in meta-analysis
    ciLower: 0,
    ciUpper: 0,
  };
}

function transformEffect(logEffect: number, measure: EffectMeasure): number {
  // Transform back from log scale for ratio measures
  if (["RR", "OR", "HR"].includes(measure)) {
    return Math.exp(logEffect);
  }
  return logEffect;
}

// Statistical distribution functions (approximations)
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
}

function chiSquareCDF(x: number, k: number): number {
  // Approximation using Wilson-Hilferty transformation
  if (k === 0) return 0;
  const z = Math.pow(x / k, 1 / 3) - (1 - 2 / (9 * k));
  const denom = Math.sqrt(2 / (9 * k));
  return normalCDF(z / denom);
}

