import { createServer } from "node:http";
const STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
};
const allowUrlApi = ["http://localhost:5173"];
const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const MESSAGES = {
  NOT_FOUND: "Không tìm thấy",
  TASK_NOT_FOUND: "Không tìm thấy công việc",
  INVALID_JSON: "Dữ liệu JSON không hợp lệ",
  TITLE_REQUIRED: "Trường 'title' là bắt buộc và phải là chuỗi không rỗng",
  TITLE_INVALID: "Trường 'title' phải là chuỗi không rỗng",
  IS_COMPLETED_INVALID: "Trường 'isCompleted' phải là kiểu boolean",
  INTERNAL_ERROR: "Lỗi hệ thống",
  TASK_LIST: "Lấy danh sách công việc thành công",
  TASK_DETAIL: "Lấy công việc thành công",
  TASK_CREATED: "Tạo công việc thành công",
  TASK_UPDATED: "Cập nhật công việc thành công",
  TASK_DELETED: "Xoá công việc thành công",
  BYPASS_SUCCESS: "Lấy data thành công",
};

const db = {
  tasks: [],
};

function serverSend(req, res, statusCode, { message, data = [] }) {
  const origin = req.headers.origin || "";

  const headers = {
    ...JSON_HEADERS,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (allowUrlApi.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  res.writeHead(statusCode, headers);
  res.end(JSON.stringify({ status: statusCode, message, data }));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error(MESSAGES.INVALID_JSON));
      }
    });
    req.on("error", reject);
  });
}

function parseIdFromPath(pathname) {
  const isPathname = pathname.startsWith("/api/tasks");
  if (isPathname) {
    return Number(pathname.split("/").pop());
  }
  return null;
}

function validateField({ req, res, task, payload, field, type, message }) {
  if (field in payload) {
    if (typeof payload[field] !== type) {
      serverSend(req, res, STATUS.BAD_REQUEST, { message });
      return false;
    }
    task[field] = payload[field];
  }
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  try {
    if (req.method === "OPTIONS") {
      const origin = req.headers.origin || "";
      const headers = {
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };

      if (allowUrlApi.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
      }

      res.writeHead(STATUS.NO_CONTENT, headers);
      return res.end();
    }

    if (req.method === "GET" && pathname === "/api/tasks") {
      return serverSend(req, res, STATUS.OK, {
        message: MESSAGES.TASK_LIST,
        data: db.tasks,
      });
    }

    if (req.method === "GET" && pathname.startsWith("/api/tasks/")) {
      const id = parseIdFromPath(pathname);
      if (id === null) {
        return serverSend(req, res, STATUS.NOT_FOUND, {
          message: MESSAGES.NOT_FOUND,
        });
      }

      const task = db.tasks.find((t) => t.id === id);
      if (!task) {
        return serverSend(req, res, STATUS.NOT_FOUND, {
          message: MESSAGES.TASK_NOT_FOUND,
        });
      }

      return serverSend(req, res, STATUS.OK, {
        message: MESSAGES.TASK_DETAIL,
        data: task,
      });
    }

    if (req.method === "POST" && pathname === "/api/tasks") {
      const payload = await parseBody(req);

      if (typeof payload.title !== "string" || payload.title.trim() === "") {
        return serverSend(req, res, STATUS.BAD_REQUEST, {
          message: MESSAGES.TITLE_REQUIRED,
        });
      }

      const newTask = {
        id: Date.now(),
        title: payload.title.trim(),
        isCompleted: false,
      };

      db.tasks.push(newTask);

      return serverSend(req, res, STATUS.CREATED, {
        message: MESSAGES.TASK_CREATED,
        data: newTask,
      });
    }

    if (req.method === "PUT" && pathname.startsWith("/api/tasks/")) {
      const id = parseIdFromPath(pathname);
      if (id === null) {
        return serverSend(req, res, STATUS.NOT_FOUND, {
          message: MESSAGES.NOT_FOUND,
        });
      }

      const task = db.tasks.find((t) => t.id === id);
      if (!task) {
        return serverSend(req, res, STATUS.NOT_FOUND, {
          message: MESSAGES.TASK_NOT_FOUND,
        });
      }

      const payload = await parseBody(req);

      if (
        !validateField({
          req,
          res,
          task,
          payload,
          field: "title",
          type: "string",
          message: MESSAGES.TITLE_INVALID,
        })
      )
        return;

      if (
        !validateField({
          req,
          res,
          task,
          payload,
          field: "isCompleted",
          type: "boolean",
          message: MESSAGES.IS_COMPLETED_INVALID,
        })
      )
        return;

      return serverSend(req, res, STATUS.OK, {
        message: MESSAGES.TASK_UPDATED,
        data: task,
      });
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/tasks/")) {
      const id = parseIdFromPath(pathname);
      if (id === null) {
        return serverSend(req, res, STATUS.NOT_FOUND, {
          message: MESSAGES.NOT_FOUND,
        });
      }

      const index = db.tasks.findIndex((t) => t.id === id);
      if (index === -1) {
        return serverSend(req, res, STATUS.NOT_FOUND, {
          message: MESSAGES.TASK_NOT_FOUND,
        });
      }

      db.tasks.splice(index, 1);

      return serverSend(req, res, STATUS.OK, {
        message: MESSAGES.TASK_DELETED,
      });
    }

    if (req.method === "GET" && pathname.startsWith("/api/bypass-cors")) {
      const queryParams = url.searchParams;
      const urlBypass = queryParams.get("url");
      const result = await fetch(urlBypass, {
        method: "GET",
      });
      const { data } = await result.json();
      return serverSend(req, res, STATUS.OK, {
        message: MESSAGES.BYPASS_SUCCESS,
        data,
      });
    }

    return serverSend(req, res, STATUS.NOT_FOUND, {
      message: MESSAGES.NOT_FOUND,
    });
  } catch (err) {
    if (err?.message === MESSAGES.INVALID_JSON) {
      return serverSend(req, res, STATUS.BAD_REQUEST, {
        message: MESSAGES.INVALID_JSON,
      });
    }

    return serverSend(req, res, 500, {
      message: MESSAGES.INTERNAL_ERROR,
    });
  }
});

server.listen(3000, "localhost", () => {
  console.log("http://localhost:3000");
});
