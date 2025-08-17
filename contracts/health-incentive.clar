;; Health Incentive Contract
;; Clarity v2
;; Manages token rewards for preventive healthcare activities with oracle verification and admin controls

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-PAUSED u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-ACTIVITY-NOT-FOUND u103)
(define-constant ERR-ALREADY-CLAIMED u104)
(define-constant ERR-INVALID-ORACLE u105)
(define-constant ERR-ZERO-ADDRESS u106)
(define-constant ERR-INVALID-REWARD-SCHEDULE u107)
(define-constant ERR-COOLDOWN-ACTIVE u108)
(define-constant ERR-INVALID-ACTIVITY-ID u109)

;; Token metadata
(define-constant TOKEN-NAME "Health Incentive Token")
(define-constant TOKEN-SYMBOL "HIT")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-REWARD-SUPPLY u1000000000) ;; 1B tokens max (with decimals)

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var oracle principal 'SP000000000000000000002Q6VF78) ;; Default to invalid, set by admin
(define-data-var total-rewards-distributed uint u0)

;; Data structures
(define-map patient-rewards principal uint) ;; Tracks total rewards per patient
(define-map activity-rewards uint { reward-amount: uint, cooldown: uint }) ;; Activity ID to reward and cooldown
(define-map last-claimed principal { activity-id: uint, block-height: uint }) ;; Tracks last claim per patient
(define-map approved-activities uint bool) ;; Tracks valid activity IDs
(define-map pending-claims { patient: principal, activity-id: uint } { status: bool, verified: bool }) ;; Oracle-verified claims

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: ensure valid oracle
(define-private (is-valid-oracle)
  (asserts! (not (is-eq (var-get oracle) 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-ORACLE))
)

;; Private helper: validate activity ID
(define-private (validate-activity-id (activity-id uint))
  (asserts! (> activity-id u0) (err ERR-INVALID-ACTIVITY-ID))
)

;; Private helper: validate patient
(define-private (validate-patient (patient principal))
  (asserts! (not (is-eq patient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Set oracle address
(define-public (set-oracle (new-oracle principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-oracle 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set oracle new-oracle)
    (ok true)
  )
)

;; Pause/unpause contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Configure reward schedule for an activity
(define-public (set-reward-schedule (activity-id uint) (reward-amount uint) (cooldown uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> reward-amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (> cooldown u0) (err ERR-INVALID-REWARD-SCHEDULE))
    (validate-activity-id activity-id)
    (map-set activity-rewards activity-id { reward-amount: reward-amount, cooldown: cooldown })
    (map-set approved-activities activity-id true)
    (ok true)
  )
)

;; Remove an activity from rewards
(define-public (remove-activity (activity-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (validate-activity-id activity-id)
    (asserts! (is-some (map-get? activity-rewards activity-id)) (err ERR-ACTIVITY-NOT-FOUND))
    (map-delete activity-rewards activity-id)
    (map-delete approved-activities activity-id)
    (ok true)
  )
)

;; Patient submits a claim for a reward
(define-public (submit-claim (activity-id uint))
  (begin
    (ensure-not-paused)
    (validate-activity-id activity-id)
    (asserts! (is-some (map-get? activity-rewards activity-id)) (err ERR-ACTIVITY-NOT-FOUND))
    (let
      (
        (patient tx-sender)
        (last-claim (default-to { activity-id: u0, block-height: u0 } (map-get? last-claimed patient)))
        (activity-data (unwrap! (map-get? activity-rewards activity-id) (err ERR-ACTIVITY-NOT-FOUND)))
        (cooldown (get cooldown activity-data))
        (current-height block-height)
      )
      (asserts! (or (is-eq (get activity-id last-claim) u0) (>= current-height (+ (get block-height last-claim) cooldown))) (err ERR-COOLDOWN-ACTIVE))
      (map-set pending-claims { patient: patient, activity-id: activity-id } { status: true, verified: false })
      (ok true)
    )
  )
)

;; Oracle verifies a patient's activity
(define-public (verify-claim (patient principal) (activity-id uint) (verified bool))
  (begin
    (asserts! (is-eq tx-sender (var-get oracle)) (err ERR-NOT-AUTHORIZED))
    (is-valid-oracle)
    (validate-activity-id activity-id)
    (validate-patient patient)
    (let
      (
        (claim-key { patient: patient, activity-id: activity-id })
        (claim (unwrap! (map-get? pending-claims claim-key) (err ERR-ACTIVITY-NOT-FOUND)))
      )
      (asserts! (get status claim) (err ERR-ALREADY-CLAIMED))
      (if verified
        (let
          (
            (activity-data (unwrap! (map-get? activity-rewards activity-id) (err ERR-ACTIVITY-NOT-FOUND)))
            (reward-amount (get reward-amount activity-data))
            (new-total (+ (var-get total-rewards-distributed) reward-amount))
          )
          (asserts! (<= new-total MAX-REWARD-SUPPLY) (err ERR-INVALID-AMOUNT))
          (map-set patient-rewards patient (+ reward-amount (default-to u0 (map-get? patient-rewards patient))))
          (map-set last-claimed patient { activity-id: activity-id, block-height: block-height })
          (var-set total-rewards-distributed new-total)
          (map-delete pending-claims claim-key)
          (ok true)
        )
        (begin
          (map-delete pending-claims claim-key)
          (ok false)
        )
      )
    )
  )
)

;; Read-only: Get patient's total rewards
(define-read-only (get-patient-rewards (patient principal))
  (ok (default-to u0 (map-get? patient-rewards patient)))
)

;; Read-only: Get reward schedule for an activity
(define-read-only (get-reward-schedule (activity-id uint))
  (ok (map-get? activity-rewards activity-id))
)

;; Read-only: Get total rewards distributed
(define-read-only (get-total-rewards-distributed)
  (ok (var-get total-rewards-distributed))
)

;; Read-only: Get last claim details
(define-read-only (get-last-claim (patient principal))
  (ok (map-get? last-claimed patient))
)

;; Read-only: Check if activity is approved
(define-read-only (is-activity-approved (activity-id uint))
  (ok (default-to false (map-get? approved-activities activity-id)))
)

;; Read-only: Get pending claim status
(define-read-only (get-pending-claim (patient principal) (activity-id uint))
  (ok (map-get? pending-claims { patient: patient, activity-id: activity-id }))
)

;; Read-only: Get oracle address
(define-read-only (get-oracle)
  (ok (var-get oracle))
)

;; Read-only: Get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: Check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)