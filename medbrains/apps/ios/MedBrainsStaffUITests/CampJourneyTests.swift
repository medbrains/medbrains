import XCTest

/// A camp run from a phone (RFCs/modules/RFC-MODULE-token-queues.md, P4c):
/// the registration table gives a number, each station calls it, and the
/// doctor in the second room finishes a patient who needs no medicine.
/// Mirrors CampJourneyTest.kt.
final class CampJourneyTests: JourneyCase {
    private var team: Api.Identity!

    override func setUp() {
        super.setUp()
        team = api.provision("camp_coordinator")
    }

    /// Signed in once the camp is set up, as a volunteer arriving at it would be.
    private func arrive() {
        app.launch()
        Session.signIn(app, as: team.username, password: team.password, home: "module-home-camp")
    }

    override func tearDown() { api.retire(team) }

    private func open(_ station: String) {
        XCTAssertTrue(reveal("camp-station-\(station)"), "the station is offered")
        el("camp-station-\(station)").tap()
    }

    func testTheNumberRegistrationGivesIsTheOneVitalsCalls() {
        let camp = api.campRoute("Phone camp")
        arrive()
        open(camp.stations[0])
        XCTAssertTrue(el("screen-camp-register").waitForExistence(timeout: 10))
        type("field-camp-name", "Meena \(Api.runId)")
        type("field-camp-age", "61")
        tapWhenReady(el("camp-register-submit"))
        XCTAssertTrue(el("camp-issued-number").waitForExistence(timeout: 15), "the number is shown at once")
        let number = el("camp-issued-number").label
        XCTAssertEqual(el("camp-issued-to").label, "Meena \(Api.runId)", "the number says whose it is once the form clears")
        shoot("camp-number-issued")
        XCTAssertTrue(api.campQueue(camp.stations[1]).contains { ($0["number"] as? String) == number }, "they wait at Vitals under that number")

        app.navigationBars.buttons.firstMatch.tap()
        open(camp.stations[1])
        tapWhenReady(el("camp-call-next"))
        tapWhenReady(el("camp-complete-\(number)"))
        XCTAssertTrue(sees("Sent to the next station", timeout: 10))
        XCTAssertTrue(api.campQueue(camp.stations[2]).contains { ($0["number"] as? String) == number && ($0["status"] as? String) == "waiting" }, "the doctor's queue has them next")
    }

    func testTheSecondDoctorCallsToTheirRoomAndFinishesWithoutPharmacy() {
        let camp = api.campRoute("Rooms camp")
        api.call("POST", "/api/camp/camps/\(camp.campId)/counters", ["counter_name": "Doctor room 2", "department_id": api.firstDepartmentId() ?? "", "counter_type": "consultation", "flow_position": 3])
        let reg = api.obj("POST", "/api/camp/registrations", ["camp_id": camp.campId, "person_name": "Ravi \(Api.runId)"])
        guard let number = reg["token_number"] as? String,
              let atVitals = api.campQueue(camp.stations[1]).first(where: { ($0["number"] as? String) == number })?["id"] as? String
        else { return XCTFail("seeded a patient at Vitals") }
        api.call("POST", "/api/tokens/\(atVitals)/call", [:])
        api.call("POST", "/api/tokens/\(atVitals)/complete")
        arrive()

        open(camp.stations[2])
        app.buttons["camp-room-picker"].firstMatch.tap()
        app.buttons["Doctor room 2"].firstMatch.tap()
        tapWhenReady(el("camp-call-next"))
        XCTAssertTrue(el("camp-finish-\(number)").waitForExistence(timeout: 15))
        let called = api.campQueue(camp.stations[2]).first { ($0["number"] as? String) == number }
        XCTAssertEqual(called?["counter_label"] as? String, "Doctor room 2", "the call names the room")
        shoot("camp-doctor-room-2")
        tapWhenReady(el("camp-finish-\(number)"))
        XCTAssertTrue(sees("Finished — not sent on", timeout: 10))
        XCTAssertFalse(api.campQueue(camp.stations[3]).contains { ($0["number"] as? String) == number }, "Pharmacy never sees them")
    }
}
