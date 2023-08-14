//JSON APIS


module.exports =  {
    "people/relationships": (req, res) => { if(req) res.json({relationships:[]}); },
    "analysis/chiasmus": (req, res) => { if(req) res.json({chiasmus:[]}); },
    "analysis/bible": (req, res) => { if(req) res.json({bible:[]}); },
    "analysis/intertextuality": (req, res) => { if(req) res.json({intertextuality:[]}); },
  }

