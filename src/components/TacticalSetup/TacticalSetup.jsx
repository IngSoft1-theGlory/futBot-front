import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import Button from "../Button/Button"
import { httpService, ApiError } from "../../services/createhttpService"
import { fetchBehaviors, filterPlayerBehaviors } from "../../services/behaviors"
import { FORMATIONS, DEFAULT_FORMATION, SUBSTITUTES_COUNT, getFormation } from "./formations"
import "./TacticalSetup.css"

const PAGE_LIMIT = 100
const EMPTY_ROW = { playerId: "", behaviorId: "" }


// GET /players es paginado: se piden todas las páginas
async function fetchAllPlayers() {
  const players = []
  let page = 1
  let totalPages = 1

  do {
    const data = await httpService.get(`/players?page=${page}&limit=${PAGE_LIMIT}`)
    players.push(...(data?.data ?? []))
    totalPages = data?.pagination?.total_pages ?? 1
    page += 1
  } while (page <= totalPages)

  return players
}

function emptyRows(count) {
  return Array.from({ length: count }, () => ({ ...EMPTY_ROW }))
}

function toRow(entry) {
  return entry
    ? { playerId: String(entry.player_id), behaviorId: String(entry.behavior_id) }
    : { ...EMPTY_ROW }
}

// Arma el estado inicial a partir de una configuración previa (si la hay)
function buildInitialLineup(initialConfig) {
  const formation = getFormation(initialConfig?.formation_type) ?? getFormation(DEFAULT_FORMATION)

  return {
    formationType: formation.type,
    starters: formation.roles.map(({ role }) =>
      toRow(initialConfig?.starting_players?.find((player) => player.role === role))
    ),
    substitutes: emptyRows(SUBSTITUTES_COUNT).map((_, index) =>
      toRow(initialConfig?.substitute_players?.[index])
    ),
  }
}

// mini cancha de ejemplo para mostrar la formación y los jugadores seleccionados

function Pitch({ formation, starters, playersById }) {
  return (
    <div className="pitch" aria-hidden="true">
      <span className="pitch__center-circle" />
      <span className="pitch__box" />
      <span className="pitch__goal-area" />

      {formation.roles.map((slot, index) => {
        const player = playersById.get(starters[index].playerId)
        return (
          <div
            key={slot.role}
            className={`pitch__player ${player ? "pitch__player--filled" : ""}`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <span className="pitch__dot">{player ? player.number : "?"}</span>
            <span className="pitch__name">{player ? player.name : slot.short}</span>
          </div>
        )
      })}
    </div>
  )
}

//

function LineupRow({ badge, label, row, players, behaviors, takenIds, variant, onChange }) {
  const isComplete = row.playerId !== "" && row.behaviorId !== ""

  return (
    <div className={`lineup-row ${isComplete ? "lineup-row--complete" : ""}`}>
      <div className="lineup-row__info">
        <span className={`lineup-row__badge lineup-row__badge--${variant}`}>{badge}</span>
        <span className="lineup-row__label">{label}</span>
      </div>

      <select
        className="lineup-row__select"
        aria-label={`Jugador (${label})`}
        value={row.playerId}
        onChange={(event) => onChange("playerId", event.target.value)}
      >
        <option value="">Elegí un jugador</option>
        {players.map((player) => {
          const id = String(player.player_id)
          return (
            <option key={id} value={id} disabled={takenIds.has(id) && id !== row.playerId}>
                {`#${player.number} ${player.name}`}
            </option>
          )
        })}
      </select>

      <select
        className="lineup-row__select"
        aria-label={`Comportamiento (${label})`}
        value={row.behaviorId}
        onChange={(event) => onChange("behaviorId", event.target.value)}
      >
        <option value="">Elegí comportamiento</option>
        {behaviors.map((behavior) => (
          <option key={behavior.behavior_id} value={String(behavior.behavior_id)}>
            {behavior.name}
          </option>
        ))}
      </select>
    </div>
  )
}

// Configuración táctica reutilizable (crear/unirse a liga o amistoso).

// Configuración táctica reutilizable (crear/unirse a liga o amistoso).
// No llama a los endpoints de crear/unirse: entrega la configuración a través de onConfirm.
function TacticalSetup({
  initialConfig,
  onConfirm,
  onCancel,
  isSubmitting = false,
  errorMessage = "",
  confirmLabel = "Confirmar",
}) {
  const [lineup, setLineup] = useState(() => buildInitialLineup(initialConfig))
  const [players, setPlayers] = useState([])
  const [behaviors, setBehaviors] = useState([])
  const [status, setStatus] = useState("loading") // loading | success | error
  const [loadError, setLoadError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isCancelled = false

    Promise.all([fetchAllPlayers(), fetchBehaviors()])
      .then(([playerList, behaviorList]) => {
        if (isCancelled) return
        setPlayers(playerList)
        // Solo se ofrecen los de jugador: un comportamiento de DT no se puede asignar en la alineación
        setBehaviors(filterPlayerBehaviors(behaviorList))
        setStatus("success")
      })
      .catch((error) => {
        if (isCancelled) return
        setLoadError(
          error instanceof ApiError
            ? error.message
            : "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo."
        )
        setStatus("error")
      })

    return () => {
      isCancelled = true
    }
  }, [reloadKey])

  const formation = getFormation(lineup.formationType)
  const allRows = [...lineup.starters, ...lineup.substitutes]

  const playersById = useMemo(
    () => new Map(players.map((player) => [String(player.player_id), player])),
    [players]
  )

  const takenIds = new Set(allRows.map((row) => row.playerId).filter(Boolean))
  const completedCount = allRows.filter((row) => row.playerId && row.behaviorId).length
  const hasDuplicates = takenIds.size !== allRows.filter((row) => row.playerId).length
  const isComplete = completedCount === allRows.length
  const canConfirm = status === "success" && isComplete && !hasDuplicates && !isSubmitting

  function handleRetry() {
    setStatus("loading")
    setReloadKey((key) => key + 1)
  }

  // Al cambiar de formación se limpian los titulares y se conservan los suplentes
  function handleFormationChange(type) {
    if (type === lineup.formationType) return
    setLineup((prev) => ({ ...prev, formationType: type, starters: emptyRows(prev.starters.length) }))
  }

  function updateRow(group, index, field, value) {
    setLineup((prev) => ({
      ...prev,
      [group]: prev[group].map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!canConfirm) return

    onConfirm?.({
      formation_type: lineup.formationType,
      starting_players: lineup.starters.map((row, index) => ({
        player_id: Number(row.playerId),
        role: formation.roles[index].role,
        behavior_id: Number(row.behaviorId),
      })),
      substitute_players: lineup.substitutes.map((row) => ({
        player_id: Number(row.playerId),
        behavior_id: Number(row.behaviorId),
      })),
    })
  }

  const minPlayers = formation.roles.length + SUBSTITUTES_COUNT

  function renderBody() {
    if (status === "loading") {
      return (
        <div className="tactical__loading" aria-busy="true" aria-label="Cargando jugadores y comportamientos">
          <span className="tactical-skeleton tactical-skeleton--pitch" />
          <div className="tactical__loading-rows">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className="tactical-skeleton tactical-skeleton--row" />
            ))}
          </div>
        </div>
      )
    }

    if (status === "error") {
      return (
        <div className="tactical__state" role="alert">
          <p className="tactical__state-text">{loadError}</p>
          <Button variant="secondary" onClick={handleRetry}>
            Reintentar
          </Button>
        </div>
      )
    }

    if (players.length < minPlayers) {
      return (
        <div className="tactical__state">
          <p className="tactical__state-text">
            Necesitás al menos {minPlayers} jugadores para armar la alineación. Por ahora tenés{" "}
            {players.length}.
          </p>
          <Link to="/players/createplayer" className="tactical__link">
            Ir a la creación de jugador →
          </Link>
        </div>
      )
    }

    return (
      <fieldset className="tactical__layout" disabled={isSubmitting}>
        <section className="tactical__formation" aria-labelledby="formation-title">
          <h3 id="formation-title" className="tactical__section-title">
            Formación
          </h3>

          <div className="formation-picker" role="radiogroup" aria-label="Formación">
            {FORMATIONS.map((option) => {
              const isSelected = option.type === lineup.formationType
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`formation-picker__option ${isSelected ? "formation-picker__option--selected" : ""}`}
                  onClick={() => handleFormationChange(option.type)}
                >
                  <span className="formation-picker__label">{option.label}</span>
                  <span className="formation-picker__description">{option.description}</span>
                </button>
              )
            })}
          </div>

          <Pitch formation={formation} starters={lineup.starters} playersById={playersById} />
        </section>

        <div className="tactical__lineup">
          <section aria-labelledby="starters-title">
            <h3 id="starters-title" className="tactical__section-title">
              Titulares
            </h3>
            <div className="lineup-list">
              {formation.roles.map((slot, index) => (
                <LineupRow
                  key={slot.role}
                  badge={slot.short}
                  label={slot.label}
                  variant="starter"
                  row={lineup.starters[index]}
                  players={players}
                  behaviors={behaviors}
                  takenIds={takenIds}
                  onChange={(field, value) => updateRow("starters", index, field, value)}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="substitutes-title">
            <h3 id="substitutes-title" className="tactical__section-title">
              Suplentes
            </h3>
            <div className="lineup-list">
              {lineup.substitutes.map((row, index) => (
                <LineupRow
                  key={index}
                  badge={`SUP ${index + 1}`}
                  label={`Suplente ${index + 1}`}
                  variant="substitute"
                  row={row}
                  players={players}
                  behaviors={behaviors}
                  takenIds={takenIds}
                  onChange={(field, value) => updateRow("substitutes", index, field, value)}
                />
              ))}
            </div>
          </section>
        </div>
      </fieldset>
    )
  }

  return (
    <form className="tactical" onSubmit={handleSubmit} noValidate>
      <header className="tactical__header">
        <div>
          <h2 className="tactical__title">Configuración táctica</h2>
          <p className="tactical__subtitle">
            Elegí la formación, tus titulares y suplentes, y el comportamiento de cada uno.
          </p>
        </div>
        {status === "success" && (
          <span className={`tactical__progress ${isComplete ? "tactical__progress--done" : ""}`}>
            {completedCount}/{allRows.length} listos
          </span>
        )}
      </header>

      {errorMessage && (
        <p className="tactical__alert" role="alert">
          {errorMessage}
        </p>
      )}

      {renderBody()}

      <footer className="tactical__actions">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isSubmitting} disabled={!canConfirm}>
          {confirmLabel}
        </Button>
      </footer>
    </form>
  )
}

export default TacticalSetup