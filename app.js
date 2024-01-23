const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let database = null;

const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const totalCovidInformation = (dbObject) => {
  return {
    totalCases: dbObject.cases,
    totalCures: dbObject.cured,
    totalActive: dbObject.active,
    totalDeaths: dbObject.deaths,
  };
};

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => console.log("Server is Running"));
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "Covid19Token");
      console.log(jwtToken);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "Covid19Token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 2

app.get("/states/", authenticationToken, async (request, response) => {
  let { username } = request;
  const getStateQuery = `
    SELECT
      *
    FROM
      state
      ORDER BY state_id
      ;`;
  const stateArray = await database.all(getStateQuery);
  const stateResult = stateArray.map((eachState) => {
    return convertStateDbObjectToResponseObject(eachState);
  });
  response.send(stateResult);
});

//API 2
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT 
      *
    FROM 
    state
    WHERE 
      state_id = ${stateId};`;
  const state = await database.get(getStateQuery);
  response.send(convertStateDbObjectToResponseObject(state));
});

//API 3
app.post("/districts/", authenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
  INSERT INTO
   district (district_name,state_id,cases,cured,active,deaths)
  VALUES
    ('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
  const newDistrict = await database.run(postDistrictQuery);
  const districtId = newDistrict.lastID;

  response.send("District Successfully Added");
});

//API 4

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT 
      *
    FROM 
   district
    WHERE 
      district_id = ${districtId};`;
    const district = await database.get(getDistrictQuery);
    response.send(convertDistrictDbObjectToResponseObject(district));
  }
);

//API 5
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
  DELETE FROM
    district
  WHERE
    district_id = ${districtId};`;
    await database.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API 6

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const { districtId } = request.params;
    const updateDistrictQuery = `
            UPDATE
               district
            SET
               district_name = '${districtName}',
               state_id = ${stateId},
               cases = ${cases},
               cured = ${cured},
               active = ${active},
               deaths = ${deaths}
            WHERE
               district_id = ${districtId};`;

    await database.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 7

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStats = `
    SELECT
     SUM(cases) AS cases,
     SUM(cured) AS cured,
     SUM(active) AS active,
     SUM(deaths) AS deaths,
    FROM
     district
    WHERE
      state_id = ${stateId};`;
    const stats = await database.get(getStateStats);
    const result = totalCovidInformation(stats);
    response.send(result);
  }
);

module.exports = app;
