describe("Locations", function() {

  "use strict";

  beforeEach(function() {
    Qminder.setKey(QMINDER_SECRET_KEY);
  });
  
  // https://www.qminder.com/docs/api/locations/#list
  it("should throw exception for missing callback in list call", function() {
    
    expect(Qminder.locations.list).toThrow("Callback function not provided");

  });

  // https://www.qminder.com/docs/api/locations/#list
  it("should list all locations", function(done) {
  
    Qminder.locations.list(function(response) {
      expect(response.statusCode).toBe(200);
      expect(response.data).not.toBe(null);
      expect(response.data.length).toBeGreaterThan(0);
      response.data.forEach(function(location) {
        expect(location.id).not.toBe(null);
        expect(location.name).not.toBe(null);
      });
      done();
    });
  });
  
  // https://www.qminder.com/docs/api/locations/#details
  it("should throw exception for missing id in details call", function() {
    
    expect(Qminder.locations.details).toThrow("Location ID not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#details
  it("should throw exception for missing callback in details call", function() {
  
    var call = function() {
      Qminder.locations.details(123);
    };
    
    expect(call).toThrow("Callback function not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#details
  it("should return location details", function(done) {
  
    Qminder.locations.list(function(r) {
      var location = r.data[0];
        
      Qminder.locations.details(location.id, function(response) {
        expect(response.statusCode).toBe(200);
        expect(response.id).not.toBe(null);
        expect(response.name).not.toBe(null);
        done();
      });
    });

  });
  
  // https://www.qminder.com/docs/api/locations/#lines
  it("should throw exception for missing id in line list call", function() {
    
    expect(Qminder.locations.lines).toThrow("Location ID not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#lines
  it("should throw exception for missing callback in line list call", function() {
  
    var call = function() {
      Qminder.locations.lines(123);
    };
    
    expect(call).toThrow("Callback function not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#lines
  it("should list all lines", function(done) {
  
    Qminder.locations.list(function(r) {
      var location = r.data[0];
        
      Qminder.locations.lines(location.id, function(response) {
        expect(response.statusCode).toBe(200);
        expect(response.data).not.toBe(null);
        expect(response.data.length).toBeGreaterThan(0);
        response.data.forEach(function(location) {
          expect(location.id).not.toBe(null);
          expect(location.name).not.toBe(null);
        });
        done();
      });
    });
  });
  
  // https://www.qminder.com/docs/api/locations/#users
  it("should throw exception for missing id in users list call", function() {
    
    expect(Qminder.locations.users).toThrow("Location ID not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#users
  it("should throw exception for missing callback in users list call", function() {
  
    var call = function() {
      Qminder.locations.users(123);
    };
    
    expect(call).toThrow("Callback function not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#users
  it("should list all users", function(done) {
  
    Qminder.locations.list(function(r) {
      var location = r.data[0];
        
      Qminder.locations.users(location.id, function(response) {
        expect(response.statusCode).toBe(200);
        expect(response.data).not.toBe(null);
        expect(response.data.length).toBeGreaterThan(0);
        response.data.forEach(function(user) {
          expect(user.id).not.toBe(null);
          expect(user.email).not.toBe(null);
          expect(user.firstName).not.toBe(null);
          expect(user.lastName).not.toBe(null);
        });
        done();
      });
    });
  });
  
  // https://www.qminder.com/docs/api/locations/#desks
  it("should throw exception for missing id in desks list call", function() {
    
    expect(Qminder.locations.desks).toThrow("Location ID not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#desks
  it("should throw exception for missing callback in desks list call", function() {
  
    var call = function() {
      Qminder.locations.desks(123);
    };
    
    expect(call).toThrow("Callback function not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#desks
  it("should list all desks", function(done) {
  
    Qminder.locations.list(function(r) {
      var location = r.data[0];
        
      Qminder.locations.desks(location.id, function(response) {
        expect(response.statusCode).toBe(200);
        expect(response.desks).not.toBe(null);
        expect(response.desks.length).toBe(0);
        done();
      });
    });
  });
  
  // https://www.qminder.com/docs/api/locations/#newline
  it("should throw exception for missing id in line creation call", function() {
    
    expect(Qminder.locations.createLine).toThrow("Location ID not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#newline
  it("should throw exception for missing name in line creation call", function() {
  
    var call = function() {
      Qminder.locations.createLine(123);
    };
    
    expect(call).toThrow("Name not provided");

  });
  
  // https://www.qminder.com/docs/api/locations/#newline
  it("should throw exception for missing callback in line creation call", function() {
  
    var call = function() {
      Qminder.locations.createLine(123, "New Service");
    };
    
    expect(call).toThrow("Callback function not provided");

  });
  
  
  // https://www.qminder.com/docs/api/locations/#newline
  it("should not create a line with too long name", function(done) {
  
    Qminder.locations.list(function(r) {
      var location = r.data[0];
        
      Qminder.locations.createLine(location.id, "1234567890123456789012345678901", function(response) {
        expect(response.statusCode).toBe(400);
        expect(response.attribute).toBe("name");
        expect(response.message).toBe("Parameter \"name\" is too long");
        expect(response.developerMessage).toBe("Maximum length is 30");
        done();
      });
    });
  });
  
  // https://www.qminder.com/docs/api/locations/#newline
  it("should create and delete a line", function(done) {
  
    Qminder.locations.list(function(r) {
      var location = r.data[0];
        
      Qminder.locations.createLine(location.id, "Danger Mice & CO", function(response) {
        expect(response.statusCode).toBe(200);
        expect(response.id).not.toBe(null);
          
        Qminder.lines.delete(response.id, function(response) {
          expect(response.statusCode).toBe(200);
          done();
        });
      });
    });
  });
});
