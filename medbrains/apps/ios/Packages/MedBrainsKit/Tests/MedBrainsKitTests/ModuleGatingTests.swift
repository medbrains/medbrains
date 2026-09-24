import SwiftUI
import XCTest
@testable import MedBrainsKit

/// The gate decides what a role sees. These pin the same decisions
/// mobile-shell's `userHasModuleAccess` made, so the conversion cannot
/// quietly show a module to someone the server would refuse.
final class ModuleGatingTests: XCTestCase {
    private func module(all: [String] = [], any: [String] = [], apps: [String] = []) -> AppModule {
        AppModule(id: "m", displayName: "M", symbol: "circle", requiredPermissions: all, requiredAnyPermissions: any, appCodes: apps) { AnyView(EmptyView()) }
    }

    private func nurse(_ permissions: [String]) -> TenantIdentity {
        TenantIdentity(tenantId: "t", userId: "u", username: "n", fullName: "Nurse", role: "nurse", permissions: permissions, departmentIds: [])
    }

    func testNobodySignedInSeesNothing() {
        XCTAssertFalse(module().isAccessible(to: nil))
    }

    func testUngatedModuleIsOpenToAnyoneSignedIn() {
        XCTAssertTrue(module().isAccessible(to: nurse([])))
    }

    func testBypassRolesSeeEverything() {
        let admin = TenantIdentity(tenantId: "t", userId: "u", username: "a", fullName: "Admin", role: "hospital_admin", permissions: [], departmentIds: [])
        XCTAssertTrue(module(all: ["nurse.dashboard.view"]).isAccessible(to: admin))
    }

    func testAllOfNeedsEveryCode() {
        let m = module(all: ["a", "b"])
        XCTAssertTrue(m.isAccessible(to: nurse(["a", "b", "c"])))
        XCTAssertFalse(m.isAccessible(to: nurse(["a"])))
    }

    func testAnyOfNeedsOneCodeOnTopOfAllOf() {
        let m = module(all: ["a"], any: ["x", "y"])
        XCTAssertTrue(m.isAccessible(to: nurse(["a", "y"])))
        XCTAssertFalse(m.isAccessible(to: nurse(["a"])))
        XCTAssertFalse(m.isAccessible(to: nurse(["x"])))
    }

    func testAppCodesRestrictSurfaces() {
        let m = module(apps: ["Mobile-Nurse"])
        XCTAssertTrue(m.belongs(to: "Mobile-Nurse"))
        XCTAssertFalse(m.belongs(to: "Mobile-Doctor"))
        XCTAssertTrue(module().belongs(to: "Mobile-Doctor"))
    }

    func testRegistryOrderIsPreservedByFiltering() {
        let registry = [module(all: ["x"]), module(all: ["y"]), module(all: ["z"])]
        let ids = registry.accessible(to: nurse(["z", "x"])).map(\.requiredPermissions)
        XCTAssertEqual(ids, [["x"], ["z"]])
    }
}
