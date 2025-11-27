<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## 🎯 Content Hub API - Enterprise Request Pipeline System

This project demonstrates the complete NestJS request lifecycle through a practical blog/content management system with role-based access control. It showcases when to use Middleware, Guards, Interceptors, Pipes, and Exception Filters in real-world scenarios.

### Key Features

- JWT Authentication & Authorization
- Role-based Access Control (Admin, Editor, Viewer)
- Article CRUD Operations
- Request Logging & Response Transformation
- Caching for Frequently Accessed Content
- Rate Limiting per User Role
- Input Validation & Sanitization

### 📚 Documentation

For detailed project requirements, architecture, and implementation guide, see the [Project Requirements](./docs/Requirement.md).

## Project setup

```bash
$ yarn install
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- Read the [Project Requirements](./docs/Requirement.md) for detailed implementation guide.

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Dixit Vora](https://github.com/vd89)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@VoraDixit89](https://x.com/VoraDixit89)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
