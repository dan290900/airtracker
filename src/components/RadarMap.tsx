import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { AIRLINE_MAP } from '../data/airlines'
import { FLEET_MAP } from '../data/fleet'
import type {
  CoverageZone,
  EnrichedFlightInfo,
  LiveFlight,
  MapStyle,
  UnitSystem,
} from '../types/aviation'
import { buildGreatCircleArc, formatAltitude } from '../utils/formatters'

interface RadarMapProps {
  flights: LiveFlight[]
  selectedHex: string | null
  onSelectFlight: (flight: LiveFlight | null) => void
  enrichedInfo: EnrichedFlightInfo | null
  coverageZones: CoverageZone[]
  showCoverageOverlay: boolean
  showLabels: boolean
  followSelected: boolean
  mapStyle: MapStyle
  theme: 'light' | 'dark'
  unitSystem: UnitSystem
  flyToTarget: { lat: number; lon: number; zoom: number; nonce: number } | null
  onViewportChange?: (viewport: { lat: number; lon: number; radiusKm: number }) => void
}

function getAircraftSilhouetteSvg(
  color: string,
  aircraftTypeId: string | null,
  isSelected: boolean,
  isDark: boolean
): string {
  const spec = aircraftTypeId ? FLEET_MAP[aircraftTypeId] : null
  const isQuad = spec?.engineCount === 4
  const isWide = spec?.category === 'widebody' || spec?.id === 'B77L'
  const strokeColor = isSelected ? '#05164D' : isDark ? '#040B24' : '#FFFFFF'
  const strokeWidth = isSelected ? 1.6 : 1.25

  if (isQuad) {
    return `<svg viewBox="0 0 36 36" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      ${isSelected ? '<circle cx="18" cy="18" r="16.5" fill="rgba(255,173,0,0.22)" stroke="#FFAD00" stroke-width="1.8" stroke-dasharray="3 2"/>' : ''}
      <path d="M18 3.5C19.3 3.5 20.1 6.4 20.2 12.2L31.5 18.8V21.5L20.2 18.5L19.8 26.8L24.5 29.8V31.8L18 30.1L11.5 31.8V29.8L16.2 26.8L15.8 18.5L4.5 21.5V18.8L15.8 12.2C15.9 6.4 16.7 3.5 18 3.5Z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
      <circle cx="11.2" cy="17.1" r="1.2" fill="${strokeColor}"/>
      <circle cx="7.9" cy="18.8" r="1.1" fill="${strokeColor}"/>
      <circle cx="24.8" cy="17.1" r="1.2" fill="${strokeColor}"/>
      <circle cx="28.1" cy="18.8" r="1.1" fill="${strokeColor}"/>
    </svg>`
  }

  if (isWide) {
    return `<svg viewBox="0 0 34 34" width="30" height="30" xmlns="http://www.w3.org/2000/svg">
      ${isSelected ? '<circle cx="17" cy="17" r="15.5" fill="rgba(255,173,0,0.22)" stroke="#FFAD00" stroke-width="1.8" stroke-dasharray="3 2"/>' : ''}
      <path d="M17 3.5C18.2 3.5 18.9 6.5 19 12L29.5 17.6V20.2L19 17.6L18.6 25.5L23 28.4V30.3L17 28.7L11 30.3V28.4L15.4 25.5L15 17.6L4.5 20.2V17.6L15 12C15.1 6.5 15.8 3.5 17 3.5Z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
    </svg>`
  }

  return `<svg viewBox="0 0 32 32" width="25" height="25" xmlns="http://www.w3.org/2000/svg">
    ${isSelected ? '<circle cx="16" cy="16" r="14.5" fill="rgba(255,173,0,0.22)" stroke="#FFAD00" stroke-width="1.8" stroke-dasharray="3 2"/>' : ''}
    <path d="M16 4.5C17 4.5 17.6 7 17.7 11.8L26.8 16.8V19L17.7 16.8L17.4 23.6L21.2 26V27.7L16 26.3L10.8 27.7V26L14.6 23.6L14.3 16.8L5.2 19V16.8L14.3 11.8C14.4 7 15 4.5 16 4.5Z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
  </svg>`
}

function createAircraftIcon(
  flight: LiveFlight,
  isSelected: boolean,
  showLabel: boolean,
  isDark: boolean
): L.DivIcon {
  const airline = AIRLINE_MAP[flight.airlineId]
  const color = isSelected ? '#FFAD00' : airline.brandColor
  const heading = flight.trackDeg ?? 0
  const svg = getAircraftSilhouetteSvg(color, flight.aircraftTypeId, isSelected, isDark)
  const size = isSelected ? 36 : 30

  const labelHtml =
    showLabel || isSelected
      ? `<div style="position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:2px;white-space:nowrap;padding:1px 5px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;line-height:1.3;background:${
          isSelected ? '#FFAD00' : isDark ? 'rgba(5,22,77,0.9)' : 'rgba(255,255,255,0.94)'
        };color:${
          isSelected ? '#05164D' : isDark ? '#F8FAFC' : '#05164D'
        };border:1px solid ${
          isSelected ? '#05164D' : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(5,22,77,0.2)'
        };box-shadow:0 2px 6px rgba(0,0,0,0.22);pointer-events:none;">${flight.callsign}</div>`
      : ''

  return L.divIcon({
    className: 'aircraft-marker-wrapper',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
      <div style="transform:rotate(${Math.round(heading)}deg);transform-origin:center;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 3px rgba(4,11,36,0.4));">
        ${svg}
      </div>
      ${labelHtml}
    </div>`,
  })
}

function buildBasemapLayers(resolvedStyle: 'street' | 'osm' | 'satellite' | 'dark'): L.TileLayer[] {
  if (resolvedStyle === 'osm') {
    return [
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }),
    ]
  }
  if (resolvedStyle === 'satellite') {
    return [
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
          maxZoom: 18,
        }
      ),
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          opacity: 0.85,
        }
      ),
    ]
  }
  if (resolvedStyle === 'dark') {
    return [
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
          maxZoom: 16,
        }
      ),
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
          opacity: 0.9,
        }
      ),
    ]
  }
  // Default 'street': crisp, rich, free Esri World Street Map (cities, airports, borders, terrain)
  return [
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap',
        maxZoom: 18,
      }
    ),
  ]
}

export function RadarMap({
  flights,
  selectedHex,
  onSelectFlight,
  enrichedInfo,
  coverageZones,
  showCoverageOverlay,
  showLabels,
  followSelected,
  mapStyle,
  theme,
  unitSystem,
  flyToTarget,
  onViewportChange,
}: RadarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayersRef = useRef<L.TileLayer[]>([])
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const markerMetaRef = useRef<Map<string, string>>(new Map())
  const coverageLayerRef = useRef<L.LayerGroup | null>(null)
  const trackLayerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelectFlight)
  const onViewportRef = useRef(onViewportChange)

  const resolvedStyle: 'street' | 'osm' | 'satellite' | 'dark' =
    mapStyle === 'auto' ? (theme === 'dark' ? 'dark' : 'street') : mapStyle
  const isDarkMap = resolvedStyle === 'dark' || resolvedStyle === 'satellite'

  useEffect(() => {
    onSelectRef.current = onSelectFlight
    onViewportRef.current = onViewportChange
  }, [onSelectFlight, onViewportChange])

  // Initialize Leaflet map once + keep size synced with ResizeObserver
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const el = containerRef.current
    const markers = markersRef.current
    const markerMeta = markerMetaRef.current

    const map = L.map(el, {
      center: [48.6, 10.2],
      zoom: 5,
      minZoom: 2,
      maxZoom: 16,
      zoomControl: false,
      worldCopyJump: true,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    coverageLayerRef.current = L.layerGroup().addTo(map)
    trackLayerRef.current = L.layerGroup().addTo(map)

    const emitViewport = () => {
      const center = map.getCenter()
      const bounds = map.getBounds()
      const ne = bounds.getNorthEast()
      const distMeters = center.distanceTo(ne)
      const radiusKm = Math.max(80, Math.min(500, Math.round(distMeters / 1000)))
      onViewportRef.current?.({
        lat: center.lat,
        lon: center.lng,
        radiusKm,
      })
    }

    map.on('moveend', emitViewport)
    map.on('click', () => {
      onSelectRef.current(null)
    })

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false })
    })
    ro.observe(el)

    mapRef.current = map
    setTimeout(() => map.invalidateSize({ animate: false }), 120)
    emitViewport()

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      markers.clear()
      markerMeta.clear()
    }
  }, [])

  // Switch basemap tiles cleanly (100% keyless, verified free tile providers)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const old of tileLayersRef.current) {
      map.removeLayer(old)
    }
    const nextLayers = buildBasemapLayers(resolvedStyle)
    for (const layer of nextLayers) {
      layer.addTo(map)
      layer.bringToBack()
    }
    // Keep reference/labels layer above base layer when 2 layers exist
    if (nextLayers.length === 2) {
      nextLayers[0].bringToBack()
    }
    tileLayersRef.current = nextLayers
  }, [resolvedStyle])

  // Render coverage zones transparently
  useEffect(() => {
    const group = coverageLayerRef.current
    if (!group) return
    group.clearLayers()
    if (!showCoverageOverlay) return

    const strokeColor = isDarkMap ? '#FFAD00' : '#05164D'
    for (const zone of coverageZones) {
      L.circle([zone.lat, zone.lon], {
        radius: zone.radiusKm * 1000,
        color: strokeColor,
        weight: 1.2,
        opacity: isDarkMap ? 0.35 : 0.25,
        dashArray: '6 6',
        fillColor: strokeColor,
        fillOpacity: isDarkMap ? 0.04 : 0.025,
        interactive: false,
      }).addTo(group)
    }
  }, [coverageZones, showCoverageOverlay, isDarkMap])

  // Efficiently sync aircraft markers without recreating existing markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const activeHexes = new Set<string>()

    for (const flight of flights) {
      activeHexes.add(flight.hex)
      const isSelected = flight.hex === selectedHex
      const headingBucket = Math.round((flight.trackDeg ?? 0) / 3) * 3
      const iconSignature = `${flight.airlineId}|${flight.aircraftTypeId ?? ''}|${headingBucket}|${isSelected ? 1 : 0}|${showLabels ? 1 : 0}|${isDarkMap ? 1 : 0}|${flight.callsign}`
      const airline = AIRLINE_MAP[flight.airlineId]
      const tooltipContent = `${flight.callsign} · ${airline.shortName} · ${flight.icaoType ?? '—'} · ${formatAltitude(flight.altBaroFt, flight.onGround, unitSystem)}`

      const existing = markersRef.current.get(flight.hex)
      if (existing) {
        existing.setLatLng([flight.lat, flight.lon])
        existing.setZIndexOffset(isSelected ? 1000 : flight.onGround ? -100 : 0)
        if (markerMetaRef.current.get(flight.hex) !== iconSignature) {
          existing.setIcon(createAircraftIcon(flight, isSelected, showLabels, isDarkMap))
          markerMetaRef.current.set(flight.hex, iconSignature)
        }
        existing.setTooltipContent(tooltipContent)
      } else {
        const marker = L.marker([flight.lat, flight.lon], {
          icon: createAircraftIcon(flight, isSelected, showLabels, isDarkMap),
          zIndexOffset: isSelected ? 1000 : flight.onGround ? -100 : 0,
        })
        marker.bindTooltip(tooltipContent, {
          direction: 'top',
          offset: [0, -14],
          className: 'aircraft-tooltip',
        })
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          onSelectRef.current(flight)
        })
        marker.addTo(map)
        markersRef.current.set(flight.hex, marker)
        markerMetaRef.current.set(flight.hex, iconSignature)
      }
    }

    for (const [hex, marker] of markersRef.current.entries()) {
      if (!activeHexes.has(hex)) {
        map.removeLayer(marker)
        markersRef.current.delete(hex)
        markerMetaRef.current.delete(hex)
      }
    }
  }, [flights, selectedHex, showLabels, isDarkMap, unitSystem])

  // Render observed flight trail + enriched great-circle route arc for selected aircraft
  useEffect(() => {
    const group = trackLayerRef.current
    const map = mapRef.current
    if (!group || !map) return
    group.clearLayers()

    if (!selectedHex) return
    const selectedFlight = flights.find((f) => f.hex === selectedHex)
    if (!selectedFlight) return

    if (selectedFlight.trail.length >= 2) {
      L.polyline(selectedFlight.trail, {
        color: '#FFAD00',
        weight: 3,
        opacity: 0.95,
      }).addTo(group)
    }

    if (!selectedFlight.onGround && selectedFlight.trackDeg !== null) {
      const rad = (selectedFlight.trackDeg * Math.PI) / 180
      const distDeg = 0.65
      const endLat = selectedFlight.lat + Math.cos(rad) * distDeg
      const endLon =
        selectedFlight.lon +
        (Math.sin(rad) * distDeg) / Math.max(0.25, Math.cos((selectedFlight.lat * Math.PI) / 180))
      L.polyline(
        [
          [selectedFlight.lat, selectedFlight.lon],
          [endLat, endLon],
        ],
        {
          color: '#FFAD00',
          weight: 2,
          opacity: 0.85,
          dashArray: '4 6',
        }
      ).addTo(group)
    }

    if (
      enrichedInfo &&
      enrichedInfo.hex === selectedFlight.hex &&
      enrichedInfo.origin &&
      enrichedInfo.destination
    ) {
      const arc = buildGreatCircleArc(
        [enrichedInfo.origin.lat, enrichedInfo.origin.lon],
        [enrichedInfo.destination.lat, enrichedInfo.destination.lon]
      )
      L.polyline(arc, {
        color: isDarkMap ? '#FFAD00' : '#05164D',
        weight: 2.2,
        opacity: 0.78,
        dashArray: '6 6',
      }).addTo(group)

      const pinStyle = (code: string, isDest: boolean) =>
        L.divIcon({
          className: '',
          iconSize: [44, 22],
          iconAnchor: [22, 11],
          html: `<div style="display:inline-flex;align-items:center;justify-content:center;padding:2px 6px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;background:${
            isDest ? '#FFAD00' : '#05164D'
          };color:${isDest ? '#05164D' : '#FFFFFF'};border:1.5px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.28);">${code}</div>`,
        })

      L.marker([enrichedInfo.origin.lat, enrichedInfo.origin.lon], {
        icon: pinStyle(enrichedInfo.origin.iata, false),
        interactive: false,
      }).addTo(group)

      L.marker([enrichedInfo.destination.lat, enrichedInfo.destination.lon], {
        icon: pinStyle(enrichedInfo.destination.iata, true),
        interactive: false,
      }).addTo(group)
    }

    if (followSelected) {
      map.panTo([selectedFlight.lat, selectedFlight.lon], { animate: true, duration: 0.65 })
    }
  }, [selectedHex, flights, enrichedInfo, followSelected, isDarkMap])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToTarget) return
    map.flyTo([flyToTarget.lat, flyToTarget.lon], flyToTarget.zoom, {
      duration: 0.85,
    })
  }, [flyToTarget])

  return (
    <div className="relative z-0 isolate h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full"
        aria-label="Interaktive Live-Flugkarte der Lufthansa Group"
      />
    </div>
  )
}
