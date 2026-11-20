import { AIRLINES } from '../data/airlines'
import type { AirlineId, MatchConfidence } from '../types/aviation'

export interface AirlineMatchResult {
  airlineId: AirlineId
  confidence: MatchConfidence
  reason: string
  flightNumber: string | null
}

const CALLSIGN_PREFIX_TO_AIRLINE: Map<string, { airlineId: AirlineId; iata: string }> = new Map()
for (const airline of AIRLINES) {
  for (const prefix of airline.callsignPrefixes) {
    CALLSIGN_PREFIX_TO_AIRLINE.set(prefix.toUpperCase(), {
      airlineId: airline.id,
      iata: airline.iata,
    })
  }
}

/**
 * Known airline-exclusive registration patterns for fallback identification
 * when a callsign is temporarily missing or non-standard (e.g. test/ferry flights).
 */
const EXCLUSIVE_REG_RULES: Array<{ pattern: RegExp; airlineId: AirlineId; label: string }> = [
  { pattern: /^D-ALF[A-Z]$/i, airlineId: 'GEC', label: 'Lufthansa Cargo 777F Registrierung (D-ALF*)' },
  { pattern: /^D-AEU[A-Z]$/i, airlineId: 'GEC', label: 'Lufthansa Cargo A321P2F Registrierung (D-AEU*)' },
  { pattern: /^D-AIM[A-N]$/i, airlineId: 'DLH', label: 'Lufthansa A380 Registrierung (D-AIM*)' },
  { pattern: /^D-ABY[A-Z]$/i, airlineId: 'DLH', label: 'Lufthansa B747-8I Registrierung (D-ABY*)' },
  { pattern: /^D-ABV[A-Z]$/i, airlineId: 'DLH', label: 'Lufthansa B747-400 Registrierung (D-ABV*)' },
  { pattern: /^D-AIX[A-Z]$/i, airlineId: 'DLH', label: 'Lufthansa A350-900 Registrierung (D-AIX*)' },
  { pattern: /^D-AIV[A-Z]$/i, airlineId: 'DLH', label: 'Lufthansa A350-900 Registrierung (D-AIV*)' },
  { pattern: /^D-ABPA|^D-ABP[B-Z]$/i, airlineId: 'DLH', label: 'Lufthansa B787-9 Registrierung (D-ABP*)' },
  { pattern: /^I-ADJ[A-Z]$/i, airlineId: 'DLA', label: 'Air Dolomiti E195 Registrierung (I-ADJ*)' },
  { pattern: /^I-JEN[A-Z]$/i, airlineId: 'DLA', label: 'Air Dolomiti E190 Registrierung (I-JEN*)' },
  { pattern: /^OO-S[NBFSC][A-Z]$/i, airlineId: 'BEL', label: 'Brussels Airlines Registrierung (OO-SN/SS/SB/SF/SC*)' },
  { pattern: /^OE-L[A-Z]{2}$/i, airlineId: 'AUA', label: 'Austrian Airlines Registrierung (OE-L*)' },
  { pattern: /^HB-JN[A-L]$/i, airlineId: 'SWR', label: 'SWISS B777-300ER Registrierung (HB-JN*)' },
  { pattern: /^HB-JH[A-N]$/i, airlineId: 'SWR', label: 'SWISS A330-300 Registrierung (HB-JH*)' },
  { pattern: /^HB-IH[A-Z]$/i, airlineId: 'EDW', label: 'Edelweiss Air Langstrecken-Registrierung (HB-IH*)' },
  { pattern: /^D-ACN[A-Z]$/i, airlineId: 'CLH', label: 'Ehem. Lufthansa CityLine Registrierung (D-ACN*)' },
]

/**
 * Identifies whether a raw ADS-B aircraft record belongs to the Lufthansa Group
 * using multi-criteria matching:
 * 1) Primary: ICAO Callsign prefix (DLH, SWR, AUA, BEL, EWG/EWL, OCN, EDW, DLA, LHX, ITY, GEC, CLH)
 * 2) Secondary: Exclusive registration pattern match (when callsign is absent or ferry/test)
 */
export function matchLufthansaGroupAirline(
  rawCallsign: string | null | undefined,
  rawRegistration: string | null | undefined,
  rawOperator?: string | null
): AirlineMatchResult | null {
  const cs = (rawCallsign ?? '').trim().toUpperCase()
  const reg = (rawRegistration ?? '').trim().toUpperCase()

  // 1. Primary: ICAO 3-letter callsign prefix followed by digit/alphanumeric flight designator
  if (cs.length >= 4) {
    const prefix = cs.slice(0, 3)
    const rest = cs.slice(3)
    const entry = CALLSIGN_PREFIX_TO_AIRLINE.get(prefix)
    if (entry && /^[0-9A-Z]+$/.test(rest)) {
      // Derive standard IATA display number when suffix is purely numeric (alphanumeric ATC callsigns differ from commercial flight numbers)
      const isPureNumeric = /^\d{1,4}$/.test(rest)
      const flightNumber = isPureNumeric ? `${entry.iata}${rest}` : null
      const extraNote =
        prefix === 'EWL'
          ? 'ICAO-Callsign EWL (Eurowings Europe, Malta)'
          : `ICAO-Callsign-Präfix ${prefix}`
      return {
        airlineId: entry.airlineId,
        confidence: 'callsign',
        reason: extraNote,
        flightNumber,
      }
    }
  }

  // 2. Secondary: Operator metadata string if provided by upstream feed
  if (rawOperator) {
    const op = rawOperator.toLowerCase()
    if (op.includes('lufthansa cargo')) {
      return { airlineId: 'GEC', confidence: 'operator', reason: 'Betreiberfeld: Lufthansa Cargo', flightNumber: null }
    }
    if (op.includes('lufthansa city airlines')) {
      return { airlineId: 'LHX', confidence: 'operator', reason: 'Betreiberfeld: Lufthansa City Airlines', flightNumber: null }
    }
    if (op.includes('lufthansa cityline')) {
      return { airlineId: 'CLH', confidence: 'operator', reason: 'Betreiberfeld: Lufthansa CityLine', flightNumber: null }
    }
    if (op.includes('lufthansa')) {
      return { airlineId: 'DLH', confidence: 'operator', reason: 'Betreiberfeld: Lufthansa', flightNumber: null }
    }
    if (op.includes('swiss international')) {
      return { airlineId: 'SWR', confidence: 'operator', reason: 'Betreiberfeld: SWISS', flightNumber: null }
    }
    if (op.includes('austrian airlines')) {
      return { airlineId: 'AUA', confidence: 'operator', reason: 'Betreiberfeld: Austrian Airlines', flightNumber: null }
    }
    if (op.includes('brussels airlines')) {
      return { airlineId: 'BEL', confidence: 'operator', reason: 'Betreiberfeld: Brussels Airlines', flightNumber: null }
    }
    if (op.includes('eurowings')) {
      return { airlineId: 'EWG', confidence: 'operator', reason: 'Betreiberfeld: Eurowings', flightNumber: null }
    }
    if (op.includes('discover airlines') || op.includes('ew discover')) {
      return { airlineId: 'OCN', confidence: 'operator', reason: 'Betreiberfeld: Discover Airlines', flightNumber: null }
    }
    if (op.includes('edelweiss')) {
      return { airlineId: 'EDW', confidence: 'operator', reason: 'Betreiberfeld: Edelweiss Air', flightNumber: null }
    }
    if (op.includes('air dolomiti')) {
      return { airlineId: 'DLA', confidence: 'operator', reason: 'Betreiberfeld: Air Dolomiti', flightNumber: null }
    }
    if (op.includes('ita airways') || op.includes('italia trasporto aereo')) {
      return { airlineId: 'ITY', confidence: 'operator', reason: 'Betreiberfeld: ITA Airways', flightNumber: null }
    }
  }

  // 3. Tertiary: Exclusive registration match (only if callsign does not belong to another carrier)
  const hasForeignCallsign = cs.length >= 4 && /^[A-Z]{3}\d/.test(cs)
  if (reg && !hasForeignCallsign) {
    for (const rule of EXCLUSIVE_REG_RULES) {
      if (rule.pattern.test(reg)) {
        return {
          airlineId: rule.airlineId,
          confidence: 'registration',
          reason: rule.label,
          flightNumber: null,
        }
      }
    }
  }

  return null
}
