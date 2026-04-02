import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import OutCall "http-outcalls/outcall";


actor {

  // ─── Legacy auth state (kept for upgrade compatibility with previous version) ──
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // ─── ETL Roles ────────────────────────────────────────────────────────────────
  type ETLRole = {
    #masterAdmin;
    #admin;
    #etlTester;
    #apiTester;
    #viewEtlTester;
    #viewApiTester;
  };

  type UserRecord = {
    principal : Principal;
    role : ETLRole;
    isActive : Bool;
    registeredAt : Int;
    registeredBy : Principal;
  };

  // ─── User State ───────────────────────────────────────────────────────────────
  var firstUserRegistered = false;
  let userRecords = Map.empty<Principal, UserRecord>();

  func ensureRegistered(caller : Principal) {
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
    if (not firstUserRegistered) {
      let record : UserRecord = {
        principal = caller;
        role = #masterAdmin;
        isActive = true;
        registeredAt = Time.now();
        registeredBy = caller;
      };
      userRecords.add(caller, record);
      firstUserRegistered := true;
    } else {
      switch (userRecords.get(caller)) {
        case (null) {
          Runtime.trap("User not registered. Contact an admin.");
        };
        case (?rec) {
          if (not rec.isActive) {
            Runtime.trap("User account is inactive. Contact an admin.");
          };
        };
      };
    };
  };

  func requireAuthenticated(caller : Principal) {
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Must be logged in");
    };
  };

  func canAssignRole(assignerRole : ETLRole, targetRole : ETLRole) : Bool {
    switch (assignerRole) {
      case (#masterAdmin) { true };
      case (#admin) {
        switch (targetRole) {
          case (#etlTester or #apiTester or #viewEtlTester or #viewApiTester) { true };
          case (_) { false };
        };
      };
      case (_) { false };
    };
  };

  func requireAdminOrMaster(caller : Principal) {
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Unauthorized") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin) {
        assert callerRecord.isActive;
      };
      case (_) { Runtime.trap("Unauthorized") };
    };
  };

  func isAdminOrMaster(caller : Principal) : Bool {
    switch (userRecords.get(caller)) {
      case (null) { false };
      case (?r) {
        r.isActive and (r.role == #masterAdmin or r.role == #admin)
      };
    };
  };

  // ─── User Management ──────────────────────────────────────────────────────────
  public shared ({ caller }) func getMyRole() : async ?UserRecord {
    requireAuthenticated(caller);
    if (not firstUserRegistered) {
      let record : UserRecord = {
        principal = caller;
        role = #masterAdmin;
        isActive = true;
        registeredAt = Time.now();
        registeredBy = caller;
      };
      userRecords.add(caller, record);
      firstUserRegistered := true;
      return ?record;
    };
    userRecords.get(caller);
  };

  public shared ({ caller }) func registerUser(user : Principal, role : ETLRole) : async () {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Caller not registered") };
      case (?r) { r };
    };
    if (not canAssignRole(callerRecord.role, role)) {
      Runtime.trap("Unauthorized: You cannot assign this role");
    };
    userRecords.add(user, {
      principal = user;
      role;
      isActive = true;
      registeredAt = Time.now();
      registeredBy = caller;
    });
  };

  public shared ({ caller }) func assignUserRole(user : Principal, role : ETLRole) : async () {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Caller not registered") };
      case (?r) { r };
    };
    if (not canAssignRole(callerRecord.role, role)) {
      Runtime.trap("Unauthorized: You cannot assign this role");
    };
    switch (userRecords.get(user)) {
      case (null) { Runtime.trap("User not found") };
      case (?existing) {
        userRecords.add(user, { existing with role });
      };
    };
  };

  public shared ({ caller }) func removeUser(user : Principal) : async () {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Caller not registered") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin) {};
      case (_) { Runtime.trap("Unauthorized: Only admins can remove users") };
    };
    userRecords.remove(user);
  };

  public shared ({ caller }) func setUserActive(user : Principal, isActive : Bool) : async () {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Caller not registered") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin) {};
      case (_) { Runtime.trap("Unauthorized") };
    };
    switch (userRecords.get(user)) {
      case (null) { Runtime.trap("User not found") };
      case (?existing) {
        userRecords.add(user, { existing with isActive });
      };
    };
  };

  public query ({ caller }) func getAllUsers() : async [UserRecord] {
    requireAuthenticated(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Unauthorized") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin) {};
      case (_) { Runtime.trap("Unauthorized: Only admins can list users") };
    };
    let list = List.empty<UserRecord>();
    for ((_, rec) in userRecords.entries()) {
      list.add(rec);
    };
    list.toArray();
  };

  // ─── Project Types ────────────────────────────────────────────────────────────
  type ProjectId = Nat;
  type SubProjectId = Nat;
  type DatasetId = Nat;
  type ConnectionId = Nat;

  type DatasetType = { #source; #target };
  type ConnectionType = { #database; #file };
  type DbType = { #db2; #sqlServer; #postgres; #mySql; #databricks };
  type FileType = { #csv; #fixedWidth; #parquet; #json; #xml };
  type SourceLocation = { #local; #network; #azureBlob };
  type JoinType = { #inner; #left; #right; #full };
  type OutputFormat = { #csv; #json; #parquet; #xml };

  module Project {
    public func compare(p1 : Project, p2 : Project) : Order.Order {
      Text.compare(p1.name, p2.name);
    };
    public func toText(p : Project) : Text { p.name };
  };
  module SubProject {
    public func compare(s1 : SubProject, s2 : SubProject) : Order.Order {
      Text.compare(s1.name, s2.name);
    };
    public func toText(s : SubProject) : Text { s.name };
  };
  module Dataset {
    public func compare(d1 : Dataset, d2 : Dataset) : Order.Order {
      Text.compare(d1.name, d2.name);
    };
    public func toText(d : Dataset) : Text { d.name };
  };
  module Connection {
    public func compare(c1 : Connection, c2 : Connection) : Order.Order {
      Text.compare(c1.name, c2.name);
    };
    public func toText(c : Connection) : Text { c.name };
  };
  module JoinConfig {
    public func compare(j1 : JoinConfig, j2 : JoinConfig) : Order.Order {
      Text.compare(j1.leftKey, j2.leftKey);
    };
    public func toText(j : JoinConfig) : Text { j.leftKey # "+" # j.rightKey };
  };
  module FieldSelection {
    public func compare(f1 : FieldSelection, f2 : FieldSelection) : Order.Order {
      Nat.compare(f1.datasetId, f2.datasetId);
    };
    public func toText(f : FieldSelection) : Text { Nat.toText(f.datasetId) };
  };

  type Project = {
    id : ProjectId;
    owner : Principal;
    name : Text;
    description : Text;
    subProjects : [SubProjectId];
    createdAt : Int;
    updatedAt : Int;
    isActive : Bool;
  };

  // Internal stable type — do NOT add fields here without migration
  type SubProject = {
    id : SubProjectId;
    projectId : ProjectId;
    name : Text;
    description : Text;
    sourceDataset : DatasetId;
    targetDataset : DatasetId;
    createdAt : Int;
    updatedAt : Int;
  };

  // Public view type returned to frontend (includes derived isActive)
  type SubProjectView = {
    id : SubProjectId;
    projectId : ProjectId;
    name : Text;
    description : Text;
    sourceDataset : DatasetId;
    targetDataset : DatasetId;
    createdAt : Int;
    updatedAt : Int;
    isActive : Bool;
  };

  type Dataset = {
    id : DatasetId;
    subProjectId : SubProjectId;
    datasetType : DatasetType;
    name : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  type Connection = {
    id : ConnectionId;
    datasetId : DatasetId;
    connectionType : ConnectionType;
    name : Text;
    dbType : ?DbType;
    host : ?Text;
    port : ?Nat;
    dbName : ?Text;
    username : ?Text;
    password : ?Text;
    tableName : ?Text;
    fileType : ?FileType;
    sourceLocation : ?SourceLocation;
    filePath : ?Text;
    createdAt : Int;
    updatedAt : Int;
  };

  type JoinConfig = {
    joinType : JoinType;
    leftConnectionId : ConnectionId;
    rightConnectionId : ConnectionId;
    leftKey : Text;
    rightKey : Text;
  };

  type FieldSelection = {
    datasetId : DatasetId;
    fields : [Text];
  };

  type MockData = {
    columns : [Text];
    rows : [[Text]];
  };

  type ConnectionTestResult = {
    ok : Bool;
    message : Text;
  };

  // ─── Internal State ───────────────────────────────────────────────────────────
  var nextProjectId = 1;
  var nextSubProjectId = 1;
  var nextDatasetId = 1;
  var nextConnectionId = 1;

  let projects = Map.empty<ProjectId, Project>();
  let subProjects = Map.empty<SubProjectId, SubProject>();
  let subProjectActive = Map.empty<SubProjectId, Bool>();
  let datasets = Map.empty<DatasetId, Dataset>();
  let connections = Map.empty<ConnectionId, Connection>();
  let joins = Map.empty<DatasetId, JoinConfig>();
  let fieldSelections = Map.empty<DatasetId, FieldSelection>();
  let outputFormats = Map.empty<DatasetId, OutputFormat>();

  // ─── Internal Helpers ─────────────────────────────────────────────────────────
  func getProjectInternal(caller : Principal, projectId : ProjectId) : Project {
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        if (project.owner != caller and not isAdminOrMaster(caller)) {
          Runtime.trap("Unauthorized: Only project owner or admin can access this project");
        };
        project;
      };
    };
  };

  func getSubProjectInternal(caller : Principal, subProjectId : SubProjectId) : SubProject {
    switch (subProjects.get(subProjectId)) {
      case (null) { Runtime.trap("Sub-project not found") };
      case (?subProject) {
        ignore getProjectInternal(caller, subProject.projectId);
        subProject;
      };
    };
  };

  func getDatasetInternal(caller : Principal, datasetId : DatasetId) : Dataset {
    switch (datasets.get(datasetId)) {
      case (null) { Runtime.trap("Dataset not found") };
      case (?dataset) {
        ignore getSubProjectInternal(caller, dataset.subProjectId);
        dataset;
      };
    };
  };

  func getConnectionInternal(caller : Principal, connectionId : ConnectionId) : Connection {
    switch (connections.get(connectionId)) {
      case (null) { Runtime.trap("Connection not found") };
      case (?connection) {
        ignore getDatasetInternal(caller, connection.datasetId);
        connection;
      };
    };
  };

  // ─── Project Management ───────────────────────────────────────────────────────
  public shared ({ caller }) func createProject(name : Text, description : Text) : async ProjectId {
    requireAdminOrMaster(caller);
    let projectId = nextProjectId;
    nextProjectId += 1;
    let project : Project = {
      id = projectId;
      owner = caller;
      name;
      description;
      subProjects = [];
      createdAt = Time.now();
      updatedAt = Time.now();
      isActive = true;
    };
    projects.add(projectId, project);
    projectId;
  };

  public shared ({ caller }) func createSubProject(projectId : ProjectId, name : Text, description : Text) : async SubProjectId {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Unauthorized") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin or #etlTester) {};
      case (_) { Runtime.trap("Unauthorized: Only Admin, Master Admin, or ETL Tester can create sub-projects") };
    };
    let project = getProjectInternal(caller, projectId);
    let subProjectId = nextSubProjectId;
    nextSubProjectId += 1;
    let sourceDatasetId = nextDatasetId;
    nextDatasetId += 1;
    let targetDatasetId = nextDatasetId;
    nextDatasetId += 1;
    datasets.add(sourceDatasetId, { id = sourceDatasetId; subProjectId = subProjectId; datasetType = #source; name = "Source Dataset"; createdAt = Time.now(); updatedAt = Time.now() });
    datasets.add(targetDatasetId, { id = targetDatasetId; subProjectId = subProjectId; datasetType = #target; name = "Target Dataset"; createdAt = Time.now(); updatedAt = Time.now() });
    subProjects.add(subProjectId, { id = subProjectId; projectId; name; description; sourceDataset = sourceDatasetId; targetDataset = targetDatasetId; createdAt = Time.now(); updatedAt = Time.now() });
    subProjectActive.add(subProjectId, true);
    projects.add(projectId, { project with subProjects = project.subProjects.concat([subProjectId]); updatedAt = Time.now() });
    subProjectId;
  };

  public shared ({ caller }) func deleteProject(projectId : ProjectId) : async () {
    requireAdminOrMaster(caller);
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        if (project.subProjects.size() > 0) {
          Runtime.trap("Cannot delete project with existing sub-projects");
        };
        projects.remove(projectId);
      };
    };
  };

  public query ({ caller }) func getProjects() : async [Project] {
    ensureRegistered(caller);
    let list = List.empty<Project>();
    for ((_, p) in projects.entries()) {
      list.add(p);
    };
    list.toArray().sort();
  };

  func toView(sp : SubProject) : SubProjectView {
    let active = switch (subProjectActive.get(sp.id)) {
      case (?v) { v };
      case (null) { true };
    };
    { id = sp.id; projectId = sp.projectId; name = sp.name; description = sp.description;
      sourceDataset = sp.sourceDataset; targetDataset = sp.targetDataset;
      createdAt = sp.createdAt; updatedAt = sp.updatedAt; isActive = active };
  };

  public query ({ caller }) func getSubProjects(projectId : ProjectId) : async [SubProjectView] {
    ensureRegistered(caller);
    ignore getProjectInternal(caller, projectId);
    let list = List.empty<SubProjectView>();
    for ((_, sp) in subProjects.entries()) {
      if (sp.projectId == projectId) { list.add(toView(sp)) };
    };
    let arr = list.toArray();
    arr.sort(func(a : SubProjectView, b : SubProjectView) : Order.Order {
      Text.compare(a.name, b.name)
    });
  };

  public shared ({ caller }) func toggleSubProjectActive(subProjectId : SubProjectId, isActive : Bool) : async () {
    requireAdminOrMaster(caller);
    switch (subProjects.get(subProjectId)) {
      case (null) { Runtime.trap("Sub-project not found") };
      case (?_) {
        subProjectActive.add(subProjectId, isActive);
      };
    };
  };

  public shared ({ caller }) func updateSubProject(subProjectId : SubProjectId, name : Text, description : Text) : async () {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Unauthorized") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin or #etlTester) {};
      case (_) { Runtime.trap("Unauthorized: Cannot edit sub-projects") };
    };
    switch (subProjects.get(subProjectId)) {
      case (null) { Runtime.trap("Sub-project not found") };
      case (?sp) {
        subProjects.add(subProjectId, { sp with name; description; updatedAt = Time.now() });
      };
    };
  };

  public shared ({ caller }) func toggleProjectActive(projectId : ProjectId, isActive : Bool) : async () {
    requireAdminOrMaster(caller);
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        projects.add(projectId, { project with isActive });
      };
    };
  };

  public shared ({ caller }) func updateProject(projectId : ProjectId, name : Text, description : Text) : async () {
    requireAdminOrMaster(caller);
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        projects.add(projectId, { project with name; description });
      };
    };
  };

  // ─── Dataset Management ───────────────────────────────────────────────────────
  public shared ({ caller }) func createDataset(subProjectId : SubProjectId, name : Text, datasetType : DatasetType) : async DatasetId {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Unauthorized") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin or #etlTester) {};
      case (_) { Runtime.trap("Unauthorized: Only Admin, Master Admin, or ETL Tester can create datasets") };
    };
    ignore getSubProjectInternal(caller, subProjectId);
    let datasetId = nextDatasetId;
    nextDatasetId += 1;
    datasets.add(datasetId, {
      id = datasetId;
      subProjectId;
      datasetType;
      name;
      createdAt = Time.now();
      updatedAt = Time.now();
    });
    datasetId;
  };

  public query ({ caller }) func getDatasetsForSubProject(subProjectId : SubProjectId) : async [Dataset] {
    ensureRegistered(caller);
    ignore getSubProjectInternal(caller, subProjectId);
    let list = List.empty<Dataset>();
    for ((_, ds) in datasets.entries()) {
      if (ds.subProjectId == subProjectId) { list.add(ds) };
    };
    let arr = list.toArray();
    arr.sort(func(a : Dataset, b : Dataset) : Order.Order {
      if (a.createdAt < b.createdAt) { #less } else if (a.createdAt > b.createdAt) { #greater } else { #equal }
    });
  };

  public shared ({ caller }) func updateDataset(datasetId : DatasetId, name : Text) : async () {
    ensureRegistered(caller);
    let callerRecord = switch (userRecords.get(caller)) {
      case (null) { Runtime.trap("Unauthorized") };
      case (?r) { r };
    };
    switch (callerRecord.role) {
      case (#masterAdmin or #admin or #etlTester) {};
      case (_) { Runtime.trap("Unauthorized: Cannot edit datasets") };
    };
    switch (datasets.get(datasetId)) {
      case (null) { Runtime.trap("Dataset not found") };
      case (?ds) {
        datasets.add(datasetId, { ds with name; updatedAt = Time.now() });
      };
    };
  };

  public shared ({ caller }) func deleteDataset(datasetId : DatasetId) : async () {
    requireAdminOrMaster(caller);
    switch (datasets.get(datasetId)) {
      case (null) { Runtime.trap("Dataset not found") };
      case (?_) {
        // Check if any connections exist for this dataset
        for ((_, conn) in connections.entries()) {
          if (conn.datasetId == datasetId) {
            Runtime.trap("Cannot delete dataset with existing connections");
          };
        };
        datasets.remove(datasetId);
      };
    };
  };

  // ─── Connection Management ────────────────────────────────────────────────────
  public shared ({ caller }) func addConnection(datasetId : DatasetId, connection : Connection) : async ConnectionId {
    ensureRegistered(caller);
    ignore getDatasetInternal(caller, datasetId);
    let connectionId = nextConnectionId;
    nextConnectionId += 1;
    connections.add(connectionId, { connection with id = connectionId; datasetId; createdAt = Time.now(); updatedAt = Time.now() });
    connectionId;
  };

  public shared ({ caller }) func deleteConnection(connectionId : ConnectionId) : async () {
    ensureRegistered(caller);
    ignore getConnectionInternal(caller, connectionId);
    connections.remove(connectionId);
  };

  public shared ({ caller }) func setJoinConfig(datasetId : DatasetId, config : JoinConfig) : async () {
    ensureRegistered(caller);
    ignore getDatasetInternal(caller, datasetId);
    joins.add(datasetId, config);
  };

  public shared ({ caller }) func setOutputFormat(datasetId : DatasetId, format : OutputFormat) : async () {
    ensureRegistered(caller);
    ignore getDatasetInternal(caller, datasetId);
    outputFormats.add(datasetId, format);
  };

  public shared ({ caller }) func setFieldSelection(datasetId : DatasetId, fields : [Text]) : async () {
    ensureRegistered(caller);
    ignore getDatasetInternal(caller, datasetId);
    fieldSelections.add(datasetId, { datasetId; fields });
  };

  public query ({ caller }) func getMockData(connectionId : ConnectionId) : async ?MockData {
    requireAuthenticated(caller);
    ignore getConnectionInternal(caller, connectionId);
    switch (connections.get(connectionId)) {
      case (null) { null };
      case (?connection) {
        let columns : [Text] = switch (connection.connectionType) {
          case (#database) {
            let prefix = switch (connection.tableName) { case (?t) { t # "_" }; case (null) { "" } };
            [prefix # "id", prefix # "name", prefix # "status", prefix # "created_date", prefix # "updated_date", prefix # "value"];
          };
          case (#file) {
            switch (connection.fileType) {
              case (? #csv) { ["record_id", "field_1", "field_2", "field_3", "field_4", "field_5"] };
              case (? #json) { ["id", "key", "value", "type", "timestamp"] };
              case (? #xml) { ["element_id", "tag", "attribute", "content", "namespace"] };
              case (? #parquet) { ["row_id", "col_a", "col_b", "col_c", "col_d"] };
              case (? #fixedWidth) { ["pos_1", "pos_2", "pos_3", "pos_4", "pos_5"] };
              case (null) { ["field_1", "field_2", "field_3", "field_4", "field_5"] };
            };
          };
        };
        let sampleValues : [[Text]] = [
          ["1", "Alice", "Active", "2024-01-15", "2024-03-01", "1500.00"],
          ["2", "Bob", "Inactive", "2024-02-20", "2024-03-10", "2300.50"],
          ["3", "Carol", "Active", "2024-03-05", "2024-03-18", "875.25"],
          ["4", "David", "Pending", "2024-03-12", "2024-03-20", "4200.00"],
          ["5", "Eve", "Active", "2024-03-15", "2024-03-22", "990.75"],
        ];
        let rows = Array.tabulate(5, func(i) {
          let base = if (i < sampleValues.size()) { sampleValues[i] } else { [] };
          Array.tabulate(columns.size(), func(j) {
            if (j < base.size()) { base[j] } else { "N/A" };
          });
        });
        ?{ columns; rows };
      };
    };
  };

  public query ({ caller }) func getDatasetById(datasetId : DatasetId) : async ?Dataset {
    requireAuthenticated(caller);
    ?getDatasetInternal(caller, datasetId);
  };

  public query ({ caller }) func getConnectionById(connectionId : ConnectionId) : async ?Connection {
    requireAuthenticated(caller);
    ?getConnectionInternal(caller, connectionId);
  };

  // ─── HTTP Outcalls ────────────────────────────────────────────────────────────
  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  public shared ({ caller }) func testDatabaseConnection(host : Text) : async ConnectionTestResult {
    ensureRegistered(caller);
    if (host.isEmpty() or host.contains(#char '/')) {
      Runtime.trap("Invalid host");
    };
    let url = "https://" # host # "/";
    try {
      ignore await OutCall.httpGetRequest(url, [], transform);
      { ok = true; message = "Host is reachable" };
    } catch (e) {
      { ok = false; message = "Failed to reach host: " # e.message() };
    };
  };
};
