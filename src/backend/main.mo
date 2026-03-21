import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  // Include authorization module
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Project Types
  type ProjectId = Nat;
  type SubProjectId = Nat;
  type DatasetId = Nat;
  type ConnectionId = Nat;

  // Dataset Types
  type DatasetType = { #source; #target };
  type ConnectionType = { #database; #file };
  type DbType = {
    #db2;
    #sqlServer;
    #postgres;
    #mySql;
    #databricks;
  };
  type FileType = { #csv; #fixedWidth; #parquet; #json; #xml };
  type SourceLocation = { #local; #network; #azureBlob };
  type JoinType = { #inner; #left; #right; #full };
  type OutputFormat = { #csv; #json; #parquet; #xml };

  module Project {
    public func compare(p1 : Project, p2 : Project) : Order.Order {
      Text.compare(p1.name, p2.name);
    };
    public func toText(project : Project) : Text {
      project.name;
    };
  };

  module SubProject {
    public func compare(s1 : SubProject, s2 : SubProject) : Order.Order {
      Text.compare(s1.name, s2.name);
    };
    public func toText(subProject : SubProject) : Text {
      subProject.name;
    };
  };

  module Dataset {
    public func compare(d1 : Dataset, d2 : Dataset) : Order.Order {
      Text.compare(d1.name, d2.name);
    };
    public func toText(dataset : Dataset) : Text {
      dataset.name;
    };
  };

  module Connection {
    public func compare(c1 : Connection, c2 : Connection) : Order.Order {
      Text.compare(c1.name, c2.name);
    };
    public func toText(connection : Connection) : Text {
      connection.name;
    };
  };

  module JoinConfig {
    public func compare(j1 : JoinConfig, j2 : JoinConfig) : Order.Order {
      Text.compare(j1.leftKey, j2.leftKey);
    };
    public func toText(joinConfig : JoinConfig) : Text {
      joinConfig.leftKey # " + " # joinConfig.rightKey;
    };
  };

  module FieldSelection {
    public func compare(f1 : FieldSelection, f2 : FieldSelection) : Order.Order {
      Text.compare(f1.datasetId.toText(), f2.datasetId.toText());
    };
    public func toText(fieldSelection : FieldSelection) : Text {
      "FieldSelection " # fieldSelection.datasetId.toText();
    };
  };

  module ProjectList {
    public func compare(t1 : [Project], t2 : [Project]) : Order.Order {
      switch (Nat.compare(t1.size(), t2.size())) {
        case (#equal) { t1.toText().compare(t2.toText()) };
        case (order) { order };
      };
    };
  };

  module SubProjectList {
    public func compare(t1 : [SubProject], t2 : [SubProject]) : Order.Order {
      switch (Nat.compare(t1.size(), t2.size())) {
        case (#equal) { t1.toText().compare(t2.toText()) };
        case (order) { order };
      };
    };
  };

  module DatasetList {
    public func compare(t1 : [Dataset], t2 : [Dataset]) : Order.Order {
      switch (Nat.compare(t1.size(), t2.size())) {
        case (#equal) { t1.toText().compare(t2.toText()) };
        case (order) { order };
      };
    };
  };

  module ConnectionList {
    public func compare(t1 : [Connection], t2 : [Connection]) : Order.Order {
      switch (Nat.compare(t1.size(), t2.size())) {
        case (#equal) { t1.toText().compare(t2.toText()) };
        case (order) { order };
      };
    };
  };

  // Project Structures
  type Project = {
    id : ProjectId;
    owner : Principal;
    name : Text;
    description : Text;
    subProjects : [SubProjectId];
    createdAt : Int;
    updatedAt : Int;
  };

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

  // Mock data types
  type MockData = {
    columns : [Text];
    rows : [[Text]];
  };

  // Internal State
  var nextProjectId = 1;
  var nextSubProjectId = 1;
  var nextDatasetId = 1;
  var nextConnectionId = 1;

  let projects = Map.empty<ProjectId, Project>();
  let subProjects = Map.empty<SubProjectId, SubProject>();
  let datasets = Map.empty<DatasetId, Dataset>();
  let connections = Map.empty<ConnectionId, Connection>();
  let joins = Map.empty<DatasetId, JoinConfig>();
  let fieldSelections = Map.empty<DatasetId, FieldSelection>();
  let outputFormats = Map.empty<DatasetId, OutputFormat>();

  // Helper functions
  func getProjectInternal(caller : Principal, projectId : ProjectId) : Project {
    switch (projects.get(projectId)) {
      case (null) { Runtime.trap("Project not found") };
      case (?project) {
        if (project.owner != caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Only the project owner or an admin can access this project");
        };
        project;
      };
    };
  };

  func getSubProjectInternal(caller : Principal, subProjectId : SubProjectId) : SubProject {
    switch (subProjects.get(subProjectId)) {
      case (null) { Runtime.trap("Sub-project not found") };
      case (?subProject) {
        // Verify ownership through parent project
        ignore getProjectInternal(caller, subProject.projectId);
        subProject;
      };
    };
  };

  func getDatasetInternal(caller : Principal, datasetId : DatasetId) : Dataset {
    switch (datasets.get(datasetId)) {
      case (null) { Runtime.trap("Dataset not found") };
      case (?dataset) {
        // Verify ownership through parent sub-project
        ignore getSubProjectInternal(caller, dataset.subProjectId);
        dataset;
      };
    };
  };

  func getConnectionInternal(caller : Principal, connectionId : ConnectionId) : Connection {
    switch (connections.get(connectionId)) {
      case (null) { Runtime.trap("Connection not found") };
      case (?connection) {
        // Verify ownership through parent dataset
        ignore getDatasetInternal(caller, connection.datasetId);
        connection;
      };
    };
  };

  // Project Management
  public shared ({ caller }) func createProject(name : Text, description : Text) : async ProjectId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create projects");
    };
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
    };

    projects.add(projectId, project);
    projectId;
  };

  public shared ({ caller }) func createSubProject(projectId : ProjectId, name : Text, description : Text) : async SubProjectId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create sub-projects");
    };
    let project = getProjectInternal(caller, projectId);

    let subProjectId = nextSubProjectId;
    nextSubProjectId += 1;

    // Create source and target datasets
    let sourceDatasetId = nextDatasetId;
    nextDatasetId += 1;
    let targetDatasetId = nextDatasetId;
    nextDatasetId += 1;

    let sourceDataset : Dataset = {
      id = sourceDatasetId;
      subProjectId = subProjectId;
      datasetType = #source;
      name = "Source Dataset";
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    let targetDataset : Dataset = {
      id = targetDatasetId;
      subProjectId = subProjectId;
      datasetType = #target;
      name = "Target Dataset";
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    datasets.add(sourceDatasetId, sourceDataset);
    datasets.add(targetDatasetId, targetDataset);

    let subProject : SubProject = {
      id = subProjectId;
      projectId;
      name;
      description;
      sourceDataset = sourceDatasetId;
      targetDataset = targetDatasetId;
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    subProjects.add(subProjectId, subProject);

    // Update project's subProjects array
    let updatedSubProjects = project.subProjects.concat([subProjectId]);
    let updatedProject : Project = {
      id = project.id;
      owner = project.owner;
      name = project.name;
      description = project.description;
      subProjects = updatedSubProjects;
      createdAt = project.createdAt;
      updatedAt = Time.now();
    };
    projects.add(projectId, updatedProject);

    subProjectId;
  };

  public shared ({ caller }) func deleteProject(projectId : ProjectId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete projects");
    };
    ignore getProjectInternal(caller, projectId);
    // Delete associated sub-projects, datasets, etc. if needed
    projects.remove(projectId);
  };

  public query ({ caller }) func getProjects() : async [Project] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view projects");
    };
    let projectList = List.empty<Project>();
    for ((_, project) in projects.entries()) {
      if (project.owner == caller or AccessControl.isAdmin(accessControlState, caller)) {
        projectList.add(project);
      };
    };
    projectList.toArray().sort();
  };

  public query ({ caller }) func getSubProjects(projectId : ProjectId) : async [SubProject] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view sub-projects");
    };
    ignore getProjectInternal(caller, projectId);
    let subProjectList = List.empty<SubProject>();
    for ((_, subProject) in subProjects.entries()) {
      if (subProject.projectId == projectId) {
        subProjectList.add(subProject);
      };
    };
    subProjectList.toArray().sort();
  };

  // Dataset Management
  public shared ({ caller }) func addConnection(datasetId : DatasetId, connection : Connection) : async ConnectionId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add connections");
    };
    // Verify ownership through dataset hierarchy
    ignore getDatasetInternal(caller, datasetId);

    let connectionId = nextConnectionId;
    nextConnectionId += 1;

    let newConnection : Connection = {
      connection with
      id = connectionId;
      datasetId;
      name = connection.name;
      createdAt = Time.now();
      updatedAt = Time.now();
    };

    connections.add(connectionId, newConnection);
    connectionId;
  };

  public shared ({ caller }) func setJoinConfig(datasetId : DatasetId, config : JoinConfig) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can set join config");
    };
    // Verify ownership through dataset hierarchy
    ignore getDatasetInternal(caller, datasetId);
    joins.add(datasetId, config);
  };

  public shared ({ caller }) func setOutputFormat(datasetId : DatasetId, format : OutputFormat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can set output format");
    };
    // Verify ownership through dataset hierarchy
    ignore getDatasetInternal(caller, datasetId);
    outputFormats.add(datasetId, format);
  };

  public shared ({ caller }) func setFieldSelection(datasetId : DatasetId, fields : [Text]) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can set field selection");
    };
    // Verify ownership through dataset hierarchy
    ignore getDatasetInternal(caller, datasetId);
    let selection : FieldSelection = {
      datasetId;
      fields;
    };
    fieldSelections.add(datasetId, selection);
  };

  // Mock Data Generation
  public query ({ caller }) func getMockData(connectionId : ConnectionId) : async ?MockData {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view mock data");
    };
    // Verify ownership through connection hierarchy
    ignore getConnectionInternal(caller, connectionId);

    switch (connections.get(connectionId)) {
      case (null) { null };
      case (?connection) {
        // Use switch statements to safely extract the Text values from optionals
        let columns : [Text] = switch (connection.tableName) {
          case (?tableName) { [tableName] };
          case (null) {
            switch (connection.filePath) {
              case (?filePath) { [filePath] };
              case (null) { ["Column1", "Column2", "Column3"] };
            };
          };
        };

        let rows = Array.tabulate(
          5,
          func(i) {
            Array.tabulate(columns.size(), func(j) { "Value" # i.toText() # "_" # j.toText() });
          },
        );
        ?{
          columns;
          rows;
        };
      };
    };
  };

  // Helper function: get dataset by id
  public query ({ caller }) func getDatasetById(datasetId : DatasetId) : async ?Dataset {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view datasets");
    };
    // Verify ownership through dataset hierarchy
    ?getDatasetInternal(caller, datasetId);
  };

  // Helper function: get connection by id
  public query ({ caller }) func getConnectionById(connectionId : ConnectionId) : async ?Connection {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view connections");
    };
    // Verify ownership through connection hierarchy
    ?getConnectionInternal(caller, connectionId);
  };
};
