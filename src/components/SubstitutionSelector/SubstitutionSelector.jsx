import { useState } from "react"
import Button from "../Button/Button"
import { ApiError } from "../../services/createhttpService"
import { requestSubstitution } from "../../services/matches"
import { getSubstitutionErrorMessage } from "../../services/substitutionErrors"
import "./SubstitutionSelector.css"

function isSessionError(error) {
  return error instanceof ApiError && error.status === 401
}

/*
 Selector para planificar un cambio durante el partido desde el panel del jugador.
 - Sale el titular del panel y entra el suplente elegido.
 - Si el back responde 202, el cambio queda planificado para la próxima pausa (onPlanned).
 - Si responde 201 (la pausa empezó mientras viajaba el pedido), ya se aplicó (onSubstituted).
 - En el panel del titular que sale se muestra el cambio planificado.
*/
function SubstitutionSelector({ matchId, teamId, player, substitutes, plannedSubstitution, onPlanned, onSubstituted }) {
  const [isOpen, setIsOpen] = useState(false)
  // El <select> guarda su valor como texto: "" significa que no se eligió nadie
  const [playerInId, setPlayerInId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const isPlannedOut = plannedSubstitution?.playerOutId === player.player_id
  const plannedIn = isPlannedOut
    ? substitutes.find((substitute) => substitute.player_id === plannedSubstitution.playerInId)
    : null

  function handleOpen() {
    setIsOpen(true)
    setPlayerInId("")
    setError("")
  }

  function handleCancel() {
    setIsOpen(false)
    setError("")
  }

  async function handleConfirm() {
    // Sin selección o con un envío en curso no se manda nada
    if (playerInId === "" || isSubmitting) return

    setIsSubmitting(true)
    setError("")

    try {
      const { planned } = await requestSubstitution(matchId, teamId, player.player_id, Number(playerInId))
      if (planned) onPlanned(player.player_id, Number(playerInId))
      else onSubstituted(player.player_id, Number(playerInId))
      setIsOpen(false)
    } catch (err) {
      // Ante un error no se toca nada: el plan anterior (si había) sigue igual
      if (!isSessionError(err)) setError(getSubstitutionErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) {
    return (
      <div className="substitution-selector">
        {isPlannedOut && (
          <p className="substitution-selector__planned" role="status">
            {plannedIn
              ? `Sale en la próxima pausa por #${plannedIn.number} ${plannedIn.name}`
              : "Sale en la próxima pausa"}
          </p>
        )}
        <Button variant="secondary" onClick={handleOpen}>
          Planificar cambio
        </Button>
      </div>
    )
  }

  const canConfirm = playerInId !== "" && !isSubmitting

  return (
    <div className="substitution-selector substitution-selector--open">
      <label className="substitution-selector__label" htmlFor={`substitution-select-${player.player_id}`}>
        Entra
      </label>
      <select
        id={`substitution-select-${player.player_id}`}
        className="substitution-selector__select"
        value={playerInId}
        onChange={(event) => setPlayerInId(event.target.value)}
        disabled={isSubmitting}
      >
        <option value="">Elegí un suplente</option>
        {substitutes.map((substitute) => (
          <option key={substitute.player_id} value={substitute.player_id}>
            #{substitute.number} {substitute.name}
          </option>
        ))}
      </select>

      {error && (
        <p className="substitution-selector__error" role="alert">
          {error}
        </p>
      )}

      <div className="substitution-selector__actions">
        <Button variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button onClick={handleConfirm} disabled={!canConfirm} isLoading={isSubmitting}>
          Confirmar
        </Button>
      </div>
    </div>
  )
}

export default SubstitutionSelector
