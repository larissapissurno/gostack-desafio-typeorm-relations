import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface IOrdersProducts {
  product_id: string;
  price: number;
  quantity: number;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found', 400);
    }

    const productsIds = products.map(productMap => ({
      id: productMap.id,
    }));

    const findProducts = await this.productsRepository.findAllById(productsIds);

    if (!findProducts.length) {
      throw new AppError('Product not found', 400);
    }

    const ordersProducts: IOrdersProducts[] = products.map(product => {
      const productSaved = findProducts.find(
        findProduct => findProduct.id === product.id,
      );

      if (product.quantity > (productSaved?.quantity || 0)) {
        throw new AppError(
          `The quantity of requested product ${productSaved?.name}, can't be bigger than ${productSaved?.quantity}`,
          400,
        );
      }

      return {
        price: productSaved?.price || 0,
        product_id: product.id,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: ordersProducts,
    });

    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
